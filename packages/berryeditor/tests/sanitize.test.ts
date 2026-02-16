import { describe, expect, it } from 'vitest'
import { sanitizeHTML } from '../src/html/sanitize'

describe('sanitizeHTML', () => {
  it('removes executable scripts', () => {
    const dirty = `<p>Hello</p><script>alert("xss")</script>`
    const safe = sanitizeHTML(dirty)
    expect(safe).toContain('<p>Hello</p>')
    expect(safe).not.toContain('<script')
  })

  it('preserves allowed attachment attributes', () => {
    const dirty = `<figure data-berry-attachment-id="x" data-berry-url="https://example.com/file.png"></figure>`
    const safe = sanitizeHTML(dirty)
    expect(safe).toContain('data-berry-attachment-id="x"')
    expect(safe).toContain('data-berry-url="https://example.com/file.png"')
  })

  it('preserves berry emoji marker attributes on image tags', () => {
    const dirty =
      '<p><img class="berry-emoji" src="https://cdn.example/1f600.svg" alt="😀" data-berry-emoji="😀"></p>'
    const safe = sanitizeHTML(dirty)

    expect(safe).toContain('class="berry-emoji"')
    expect(safe).toContain('data-berry-emoji="😀"')
    expect(safe).toContain('src="https://cdn.example/1f600.svg"')
  })

  it('preserves blob urls for attachment attrs and media/link tags', () => {
    const dirty =
      '<figure data-berry-attachment-id="x" data-berry-url="blob:https://example.com/file" data-berry-preview-url="blob:https://example.com/preview" data-berry-filename="file.pdf" data-berry-filesize="10" data-berry-content-type="application/pdf"><a href="blob:https://example.com/file">file.pdf</a><img src="blob:https://example.com/preview" alt="preview"></figure>'
    const safe = sanitizeHTML(dirty)

    expect(safe).toContain('data-berry-url="blob:https://example.com/file"')
    expect(safe).toContain('data-berry-preview-url="blob:https://example.com/preview"')
    expect(safe).toContain('href="blob:https://example.com/file"')
    expect(safe).toContain('src="blob:https://example.com/preview"')
  })

  it('removes unsafe javascript urls from attachment attrs and media/link tags', () => {
    const dirty =
      '<figure data-berry-attachment-id="x" data-berry-url="javascript:alert(1)" data-berry-preview-url="javascript:alert(2)" data-berry-filename="file.pdf" data-berry-filesize="10" data-berry-content-type="application/pdf"><a href="javascript:alert(3)">file.pdf</a><img src="javascript:alert(4)" alt="preview"></figure>'
    const safe = sanitizeHTML(dirty)

    expect(safe).not.toContain('javascript:alert(')
    expect(safe).not.toContain('data-berry-url=')
    expect(safe).not.toContain('data-berry-preview-url=')
    expect(safe).not.toContain('href=')
    expect(safe).not.toContain('src=')
  })

  it('preserves table tags and allowed styles', () => {
    const dirty =
      '<table style="text-align:center;line-height:1.5;color:#112233;font-size:14px;font-family:Georgia, serif"><tbody><tr><td style="background-color:#ffeeaa">Cell</td></tr></tbody></table>'
    const safe = sanitizeHTML(dirty)

    expect(safe).toContain('<table')
    expect(safe).toContain('<td')
    expect(safe).toContain('text-align:center')
    expect(safe).toContain('line-height:1.5')
    expect(safe).toContain('font-size:14px')
    expect(safe).toContain('font-family:Georgia, serif')
    expect(safe).toContain('background-color:#ffeeaa')
    expect(safe).toContain('color:#112233')
  })

  it('preserves safe table border styles for bordered table insertion', () => {
    const dirty =
      '<table style="border-collapse:collapse"><tbody><tr><td style="border:1px solid #000">Cell</td><td style="border:2px dashed #000">X</td></tr></tbody></table>'
    const safe = sanitizeHTML(dirty)

    expect(safe).toContain('border-collapse:collapse')
    expect(safe).toContain('border:1px solid #000000')
    expect(safe).not.toContain('2px dashed')
  })

  it('preserves safe image layout attrs and styles', () => {
    const dirty =
      '<figure class="berry-attachment berry-attachment--image" data-berry-attachment-id="x" data-berry-url="https://example.com/file.png" data-berry-filename="file.png" data-berry-filesize="10" data-berry-content-type="image/png" data-berry-image-align="right" data-berry-image-wrap="true" data-berry-image-wrap-side="left" data-berry-image-padding="12" data-berry-image-width="60" data-berry-image-width-unit="percent"><div class="berry-attachment__body" style="padding:12px"><img src="https://example.com/file.png" style="width:60%" alt="preview"></div></figure>'
    const safe = sanitizeHTML(dirty)

    expect(safe).toContain('data-berry-image-align="right"')
    expect(safe).toContain('data-berry-image-wrap="true"')
    expect(safe).toContain('data-berry-image-padding="12"')
    expect(safe).toContain('style="padding:12px"')
    expect(safe).toContain('style="width:60%"')
  })

  it('strips unsafe width and padding styles', () => {
    const dirty =
      '<figure data-berry-attachment-id="x" data-berry-url="https://example.com/file.png" data-berry-filename="file.png" data-berry-filesize="10" data-berry-content-type="image/png"><div class="berry-attachment__body" style="padding:-10px"><img src="https://example.com/file.png" style="width:calc(100% - 10px);padding:999px" alt="preview"></div></figure>'
    const safe = sanitizeHTML(dirty)

    expect(safe).not.toContain('calc(100%')
    expect(safe).not.toContain('padding:-10px')
    expect(safe).not.toContain('padding:999px')
    expect(safe).not.toContain('style="width:')
  })

  it('strips disallowed and invalid styles', () => {
    const dirty =
      '<p style="position:absolute;color:red;background-color:#12;line-height:6;text-align:diagonal;font-size:5px;font-family:url(javascript:alert(1))">Hello</p>'
    const safe = sanitizeHTML(dirty)

    expect(safe).toContain('<p')
    expect(safe).not.toContain('position:absolute')
    expect(safe).not.toContain('color:red')
    expect(safe).not.toContain('line-height:6')
    expect(safe).not.toContain('text-align:diagonal')
    expect(safe).not.toContain('font-size:5px')
    expect(safe).not.toContain('font-family:url')
  })

  it('normalizes rgb colors to hex', () => {
    const dirty = '<p style="color:rgb(14, 165, 233);background-color:rgba(225,29,72,1)">Hello</p>'
    const safe = sanitizeHTML(dirty)

    expect(safe).toContain('color:#0ea5e9')
    expect(safe).toContain('background-color:#e11d48')
    expect(safe).not.toContain('rgb(')
    expect(safe).not.toContain('rgba(')
  })
})
