import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode, useState, type ReactElement } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { UNICODE_EMOJI_VERSION } from '../src/react/emojiCatalog'
import { EmojiPicker } from '../src/react/EmojiPicker'
import type { EmojiInsertPayload } from '../src/react/types'

const RECENTS_STORAGE_KEY = `berryeditor:emoji-picker:v${UNICODE_EMOJI_VERSION}:recents`

function EmojiPickerHost({
  onInserted
}: {
  onInserted: (payload: EmojiInsertPayload) => void
}): ReactElement {
  const [open, setOpen] = useState(true)

  if (!open) return <div>closed</div>

  return (
    <EmojiPicker
      disabled={false}
      options={{ persistPreferences: false, persistRecents: true }}
      onInsert={(payload) => {
        onInserted(payload)
        setOpen(false)
      }}
      onClose={() => setOpen(false)}
    />
  )
}

describe('EmojiPicker recents', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('renders category emoji entries in Unicode catalog order', async () => {
    render(
      <EmojiPicker
        disabled={false}
        options={{ persistPreferences: false, persistRecents: false }}
        onInsert={() => {}}
        onClose={() => {}}
      />
    )

    const categorySelect = (await screen.findByRole('combobox', {
      name: 'Emoji category'
    })) as HTMLSelectElement
    fireEvent.change(categorySelect, { target: { value: 'Smileys & Emotion' } })

    await waitFor(() => {
      expect(document.querySelectorAll('.berry-emoji-picker__emoji-button').length).toBeGreaterThan(20)
    })

    const emojiButtons = Array.from(
      document.querySelectorAll('.berry-emoji-picker__emoji-button')
    ) as HTMLButtonElement[]

    expect(emojiButtons[0]?.getAttribute('aria-label')).toBe('grinning face')
    expect(emojiButtons[1]?.getAttribute('aria-label')).toBe('grinning face with big eyes')
    expect(emojiButtons[2]?.getAttribute('aria-label')).toBe('grinning face with smiling eyes')
  })

  it('allows switching to recents when there are no recent emojis', async () => {
    render(
      <EmojiPicker
        disabled={false}
        options={{ persistPreferences: false, persistRecents: true }}
        onInsert={() => {}}
        onClose={() => {}}
      />
    )

    const categorySelect = (await screen.findByRole('combobox', {
      name: 'Emoji category'
    })) as HTMLSelectElement

    fireEvent.change(categorySelect, { target: { value: '__recents__' } })

    await waitFor(() => {
      expect(categorySelect.value).toBe('__recents__')
      expect(screen.getByText('No emojis available for this section.')).toBeInTheDocument()
    })
  })

  it('hides recents category when recents persistence is disabled', async () => {
    render(
      <EmojiPicker
        disabled={false}
        options={{ persistPreferences: false, persistRecents: false }}
        onInsert={() => {}}
        onClose={() => {}}
      />
    )

    const categorySelect = (await screen.findByRole('combobox', {
      name: 'Emoji category'
    })) as HTMLSelectElement

    const optionValues = Array.from(categorySelect.options).map((option) => option.value)
    expect(optionValues).not.toContain('__recents__')
    expect(categorySelect.value).not.toBe('__recents__')
  })

  it('renders Twemoji images by default', async () => {
    render(
      <EmojiPicker
        disabled={false}
        options={{ persistPreferences: false, persistRecents: false }}
        onInsert={() => {}}
        onClose={() => {}}
      />
    )

    fireEvent.change(await screen.findByRole('textbox', { name: 'Search emoji' }), {
      target: { value: 'rocket' }
    })

    const rocketButton = await screen.findByRole('button', { name: 'rocket' })
    expect(rocketButton.querySelector('img')).not.toBeNull()
  })

  it('can render native Unicode emoji glyphs instead of Twemoji images', async () => {
    render(
      <EmojiPicker
        disabled={false}
        options={{ persistPreferences: false, persistRecents: false, useTwemoji: false }}
        onInsert={() => {}}
        onClose={() => {}}
      />
    )

    fireEvent.change(await screen.findByRole('textbox', { name: 'Search emoji' }), {
      target: { value: 'rocket' }
    })

    const rocketButton = await screen.findByRole('button', { name: 'rocket' })
    expect(rocketButton.querySelector('img')).toBeNull()
    expect(rocketButton).toHaveTextContent(String.fromCodePoint(0x1f680))
  })

  it('persists recents when picker closes immediately after selection', async () => {
    let inserted: EmojiInsertPayload | null = null

    render(
      <EmojiPickerHost
        onInserted={(payload) => {
          inserted = payload
        }}
      />
    )

    fireEvent.change(await screen.findByRole('textbox', { name: 'Search emoji' }), {
      target: { value: 'rocket' }
    })
    fireEvent.click(await screen.findByRole('button', { name: /rocket/i }))

    await waitFor(() => {
      expect(inserted).not.toBeNull()
      const persisted = JSON.parse(window.localStorage.getItem(RECENTS_STORAGE_KEY) ?? '[]') as string[]
      expect(persisted[0]).toBe(inserted?.unicode)
    })
  })

  it('resolves persisted recents without variation selectors', async () => {
    window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(['\u2764']))

    render(
      <EmojiPicker
        disabled={false}
        options={{ persistPreferences: false, persistRecents: true }}
        onInsert={() => {}}
        onClose={() => {}}
      />
    )

    fireEvent.change(await screen.findByRole('combobox', { name: 'Emoji category' }), {
      target: { value: '__recents__' }
    })

    expect(await screen.findByRole('button', { name: /red heart/i })).toBeInTheDocument()
  })

  it('keeps persisted recents in React strict mode', async () => {
    window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(['\u{1F680}']))

    render(
      <StrictMode>
        <EmojiPicker
          disabled={false}
          options={{ persistPreferences: false, persistRecents: true }}
          onInsert={() => {}}
          onClose={() => {}}
        />
      </StrictMode>
    )

    fireEvent.change(await screen.findByRole('combobox', { name: 'Emoji category' }), {
      target: { value: '__recents__' }
    })

    expect(await screen.findByRole('button', { name: /rocket/i })).toBeInTheDocument()
  })

  it('can hide categories and show all emoji entries', async () => {
    render(
      <EmojiPicker
        disabled={false}
        options={{ persistPreferences: false, persistRecents: false, showCategories: false }}
        onInsert={() => {}}
        onClose={() => {}}
      />
    )

    expect(screen.queryByRole('combobox', { name: 'Emoji category' })).not.toBeInTheDocument()

    await waitFor(() => {
      expect(document.querySelectorAll('.berry-emoji-picker__emoji-button').length).toBeGreaterThan(1000)
    })

    const emojiButtons = Array.from(
      document.querySelectorAll('.berry-emoji-picker__emoji-button')
    ) as HTMLButtonElement[]

    expect(emojiButtons[0]?.getAttribute('aria-label')).toBe('grinning face')
    expect(emojiButtons[1]?.getAttribute('aria-label')).toBe('grinning face with big eyes')
    expect(emojiButtons[2]?.getAttribute('aria-label')).toBe('grinning face with smiling eyes')
  })
})
