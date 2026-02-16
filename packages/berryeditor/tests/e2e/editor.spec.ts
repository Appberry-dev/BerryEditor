import { expect, test } from '@playwright/test'

test('home demo editor accepts typing', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('textbox', { name: 'Rich text editor' })
  await editor.click()
  await editor.type('Berry')

  await expect(editor).toContainText('Berry')
})

test('home page renders editor demo', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('textbox')).toBeVisible()
})

test('toolbar exposes upgraded controls', async ({ page }) => {
  await page.goto('/')
  const shell = page.locator('.berry-shell').first()

  await expect(shell.getByRole('button', { name: 'Underline' })).toBeVisible()
  await expect(shell.getByRole('button', { name: 'Image' })).toBeVisible()
  await expect(shell.getByRole('button', { name: 'Document' })).toBeVisible()
  await expect(shell.getByRole('button', { name: 'Table' })).toBeVisible()
  await expect(shell.getByRole('button', { name: 'Emoji' })).toBeVisible()
  await expect(shell.getByRole('button', { name: 'Macro' })).toBeVisible()

  await shell.getByRole('button', { name: 'Text color' }).click()
  await expect(page.locator('.bp-app')).toBeVisible()

  await shell.getByRole('button', { name: 'Highlight color' }).click()
  await expect(page.locator('.bp-app')).toBeVisible()

  const editor = shell.getByRole('textbox', { name: 'Rich text editor' })
  await editor.click()
  await page.keyboard.press('Control+A')

  await shell.getByRole('button', { name: 'Text color' }).click()
  const textColorFlyout = page
    .locator('.berry-toolbar__popover-content')
    .filter({ has: page.getByRole('textbox', { name: 'Color input' }) })
    .first()
  await expect(textColorFlyout).toBeVisible()
  await textColorFlyout.getByRole('textbox', { name: 'Color input' }).fill('#e11d48')
  await textColorFlyout.getByRole('button', { name: 'Apply' }).click()

  await expect(editor).toContainText('Welcome to BerryEditor')
  await expect(editor).toContainText('BerryEditor combines')

  const editorHTML = await editor.evaluate((node) => node.innerHTML)
  expect(editorHTML).toContain('color:#e11d48')
})

test('emoji picker tracks inserted emoji in recents on the demo page', async ({ page }) => {
  await page.goto('/')
  const shell = page.locator('.berry-shell').first()

  await shell.getByRole('button', { name: 'Emoji' }).click()
  await page.getByRole('textbox', { name: 'Search emoji' }).fill('rocket')
  await page.getByRole('button', { name: /rocket/i }).first().click()

  const persistedRecents = await page.evaluate(() => {
    const storageKey = Object.keys(localStorage).find((key) => key.endsWith(':recents'))
    if (!storageKey) return []
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  })
  expect(persistedRecents.length).toBeGreaterThan(0)

  await shell.getByRole('button', { name: 'Emoji' }).click()
  const category = page.getByRole('combobox', { name: 'Emoji category' })
  await category.selectOption('__recents__')
  await expect(page.getByRole('button', { name: /rocket/i }).first()).toBeVisible()
})

const inlineMarkCases: Array<{ button: string; pattern: RegExp }> = [
  { button: 'Bold', pattern: /<(?:strong|b)>beta<\/(?:strong|b)>/i },
  { button: 'Italic', pattern: /<(?:em|i)>beta<\/(?:em|i)>/i },
  { button: 'Underline', pattern: /<u>beta<\/u>/i },
  { button: 'Strikethrough', pattern: /<(?:s|strike)>beta<\/(?:s|strike)>/i }
]

for (const scenario of inlineMarkCases) {
  test(`inline formatting button applies ${scenario.button.toLowerCase()} mark`, async ({ page }) => {
    await page.goto('/')
    const shell = page.locator('.berry-shell').first()
    const editor = shell.getByRole('textbox', { name: 'Rich text editor' })

    await editor.click()
    await editor.evaluate((node) => {
      const root = node as HTMLElement
      root.innerHTML = '<p>alpha beta gamma</p>'
      const textNode = root.querySelector('p')?.firstChild
      if (!(textNode instanceof Text)) return
      const target = 'beta'
      const start = textNode.data.indexOf(target)
      if (start < 0) return
      const end = start + target.length

      const range = document.createRange()
      range.setStart(textNode, start)
      range.setEnd(textNode, end)
      const selection = window.getSelection()
      if (!selection) return
      selection.removeAllRanges()
      selection.addRange(range)
    })

    await shell.getByRole('button', { name: scenario.button }).click()
    const editorHTML = await editor.evaluate((node) => node.innerHTML)
    expect(editorHTML).toMatch(scenario.pattern)
  })
}

test('disabled mode blocks mutation controls and content edits', async ({ page }) => {
  await page.goto('/')
  const shell = page.locator('.berry-shell').first()
  const editor = shell.getByRole('textbox', { name: 'Rich text editor' })
  const disableToggle = page.getByRole('button', { name: 'Disable editor' })
  const boldButton = shell.getByRole('button', { name: 'Bold' })

  await expect(editor).toContainText('Welcome to BerryEditor')
  const initialHTML = await editor.evaluate((node) => node.innerHTML)

  await disableToggle.click()
  await expect(boldButton).toBeDisabled()

  await editor.click()
  await page.keyboard.type('blocked while disabled')

  const nextHTML = await editor.evaluate((node) => node.innerHTML)
  expect(nextHTML).toBe(initialHTML)
})

test('html mode sanitizes dangerous markup when switching back to rich text', async ({ page }) => {
  await page.goto('/')
  const shell = page.locator('.berry-shell').first()

  const toHTMLModeButton = shell.getByRole('button', { name: 'Switch to HTML mode' })
  await expect(toHTMLModeButton).toBeVisible({ timeout: 15_000 })
  await toHTMLModeButton.click()

  const htmlEditor = shell.locator('textarea.berry-html-editor[aria-label="HTML editor"]')
  await expect(htmlEditor).toBeVisible({ timeout: 15_000 })
  await htmlEditor.fill('<p>Safe</p><script>alert(1)</script><img src="x" onerror="alert(2)" />')

  const toRichModeButton = shell.getByRole('button', { name: 'Switch to rich text mode' })
  await expect(toRichModeButton).toBeVisible()
  await toRichModeButton.click()

  const editor = shell.getByRole('textbox', { name: 'Rich text editor' })
  await expect(editor).toBeVisible()
  await expect(editor).toContainText('Safe')

  const editorHTML = await editor.evaluate((node) => node.innerHTML)
  expect(editorHTML).not.toContain('<script')
  expect(editorHTML).not.toContain('onerror=')
})
