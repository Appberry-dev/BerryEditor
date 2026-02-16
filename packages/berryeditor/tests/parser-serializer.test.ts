import { describe, expect, it } from 'vitest'
import { parseHTML } from '../src/html/parser'
import { serializeHTML } from '../src/html/serializer'

describe('parser/serializer', () => {
  it('round-trips formatted text blocks', () => {
    const html =
      '<h1>Title</h1><h3 style="text-align:center;line-height:1.5;font-size:18px;font-family:Georgia, serif"><u><span style="color:#0ea5e9">Hello</span></u> <span style="background-color:#facc15">world</span></h3>'
    const model = parseHTML(html)
    const serialized = serializeHTML(model)

    expect(model.blocks.length).toBe(2)
    expect(serialized).toContain('<h1>Title</h1>')
    expect(serialized).toContain('<h3')
    expect(serialized).toContain('<u>')
    expect(serialized).toContain('color:#0ea5e9')
    expect(serialized).toContain('background-color:#facc15')
    expect(serialized).toContain('text-align:center')
    expect(serialized).toContain('line-height:1.5')
    expect(serialized).toContain('font-size:18px')
    expect(serialized).toContain('font-family:Georgia, serif')
  })

  it('parses and serializes attachments', () => {
    const html =
      '<p>Start</p><figure data-berry-attachment-id="a1" data-berry-url="https://example.com/a.png" data-berry-filename="a.png" data-berry-filesize="120" data-berry-content-type="image/png"><img src="https://example.com/a.png" alt="a.png"><figcaption>caption</figcaption></figure>'
    const model = parseHTML(html)
    const serialized = serializeHTML(model)

    expect(JSON.stringify(model)).toContain('"kind":"attachment"')
    expect(serialized).toContain('data-berry-attachment-id="a1"')
    expect(serialized).toContain('<figcaption>caption</figcaption>')
  })

  it('round-trips image attachment layout metadata', () => {
    const html =
      '<figure class="berry-attachment berry-attachment--image" data-berry-attachment-id="a2" data-berry-url="https://example.com/a.png" data-berry-filename="a.png" data-berry-filesize="120" data-berry-content-type="image/png" data-berry-image-align="center" data-berry-image-wrap="true" data-berry-image-wrap-side="right" data-berry-image-padding="16" data-berry-image-width="60" data-berry-image-width-unit="percent"><div class="berry-attachment__body" style="padding:16px"><a href="https://example.com" target="_blank" rel="noopener noreferrer"><img src="https://example.com/a.png" alt="a.png" style="width:60%"></a></div><figcaption>caption</figcaption></figure>'
    const model = parseHTML(html)
    const serialized = serializeHTML(model)

    expect(JSON.stringify(model)).toContain('"imageAlign":"center"')
    expect(JSON.stringify(model)).toContain('"wrapText":true')
    expect(JSON.stringify(model)).toContain('"wrapSide":"right"')
    expect(JSON.stringify(model)).toContain('"padding":16')
    expect(JSON.stringify(model)).toContain('"width":60')
    expect(JSON.stringify(model)).toContain('"widthUnit":"percent"')
    expect(JSON.stringify(model)).toContain('"linkUrl":"https://example.com"')
    expect(serialized).toContain('data-berry-image-align="center"')
    expect(serialized).toContain('data-berry-image-wrap="true"')
    expect(serialized).toContain('data-berry-image-padding="16"')
    expect(serialized).toContain('style="width:60%"')
  })

  it('round-trips table and horizontal rule blocks', () => {
    const html =
      '<table style="text-align:right"><tbody><tr><th scope="col">H</th><td style="line-height:1.8">A</td></tr><tr><td colspan="2">B</td></tr></tbody></table><hr>'
    const model = parseHTML(html)
    const serialized = serializeHTML(model)

    expect(JSON.stringify(model)).toContain('"type":"table"')
    expect(JSON.stringify(model)).toContain('"type":"horizontalRule"')
    expect(serialized).toContain('<table')
    expect(serialized).toContain('<th')
    expect(serialized).toContain('line-height:1.8')
    expect(serialized).toContain('colspan="2"')
    expect(serialized).toContain('<hr>')
  })

  it('maps berry emoji images to inline text nodes', () => {
    const html =
      '<p>Hello <img class="berry-emoji" draggable="false" alt="😀" data-berry-emoji="😀" src="https://cdn.example/1f600.svg"> world</p>'
    const model = parseHTML(html)
    const serialized = serializeHTML(model)

    expect(JSON.stringify(model)).toContain('😀')
    expect(serialized).toContain('Hello')
    expect(serialized).toContain('world')
  })

  it('preserves text link target metadata when opening in a new tab', () => {
    const html = '<p><a href="https://example.com/docs" target="_blank" rel="noopener noreferrer">Docs</a></p>'
    const model = parseHTML(html)
    const serialized = serializeHTML(model)

    expect(JSON.stringify(model)).toContain('"link":"https://example.com/docs"')
    expect(JSON.stringify(model)).toContain('"linkTarget":"_blank"')
    expect(serialized).toContain('target="_blank"')
    expect(serialized).toContain('rel="noopener noreferrer"')
  })

  it('preserves image links without forcing new-tab target attributes', () => {
    const html =
      '<figure class="berry-attachment berry-attachment--image" data-berry-attachment-id="a3" data-berry-url="https://example.com/a.png" data-berry-filename="a.png" data-berry-filesize="120" data-berry-content-type="image/png"><div class="berry-attachment__body"><a href="https://example.com/internal"><img src="https://example.com/a.png" alt="a.png"></a></div><figcaption>caption</figcaption></figure>'
    const model = parseHTML(html)
    const serialized = serializeHTML(model)
    const doc = new DOMParser().parseFromString(serialized, 'text/html')
    const link = doc.querySelector('figure a')

    expect(JSON.stringify(model)).toContain('"linkUrl":"https://example.com/internal"')
    expect(JSON.stringify(model)).toContain('"linkOpenInNewTab":false')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('target')).toBeNull()
    expect(link?.getAttribute('rel')).toBeNull()
  })
})
