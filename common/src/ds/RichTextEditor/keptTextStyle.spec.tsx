import { Editor } from '@tiptap/core'
import { TextStyleKit } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'

import { KeptTextStyle } from './keptTextStyle'

/** The HTML the editor gives back for `content`, configured as the composer */
function load(content: string): string {
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ trailingNode: false, link: false }),
      TextStyleKit.configure({ lineHeight: false, textStyle: false }),
      KeptTextStyle
    ],
    content
  })
  const html = editor.getHTML()
  editor.destroy()
  return html
}

describe('KeptTextStyle', () => {
  it.each([
    '<p><b><span style="font-weight:bold">Bold</span> and</b></p>',
    '<p><span style="font-weight: bold">Bold</span> run</p>',
    '<p><span style="color: ;">empty</span> value</p>',
    '<p><span style="">empty</span> style</p>'
  ])('drops a span without a kept style, and is stable on reload: %s', html => {
    const first = load(html)
    expect(first).not.toContain('<span')
    expect(load(first)).toBe(first)
  })

  it('merges the bold runs around a dropped span', () => {
    expect(
      load('<p><b><span style="font-weight:bold">Bold</span> and</b></p>')
    ).toBe('<p><strong>Bold and</strong></p>')
  })

  it.each([
    ['<p><span style="color: red">red</span></p>', 'color: red;'],
    [
      '<p><span style="background-color: yellow">hi</span></p>',
      'background-color: yellow;'
    ],
    [
      '<p><span style="font-family: Arial; font-weight: bold">a</span></p>',
      'font-family: Arial;'
    ],
    ['<p><span style="font-size: 14px">a</span></p>', 'font-size: 14px;']
  ])('keeps a span with a kept style: %s', (html, style) => {
    const first = load(html)
    expect(first).toContain(`<span style="${style}">`)
    expect(load(first)).toBe(first)
  })

  it('keeps the colour of a parent span on a nested span', () => {
    const first = load(
      '<p><span style="color: red"><span style="font-weight: bold">a</span>b</span></p>'
    )
    expect(first).toBe(
      '<p><span style="color: red;"><strong>a</strong>b</span></p>'
    )
    expect(load(first)).toBe(first)
  })
})
