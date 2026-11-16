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

describe('KeptTextStyle with the same style spelled differently', () => {
  it.each([
    '<p><span style="color:#1F497D"><b>Hi</b></span><span style="color:#1f497d"><b> there</b></span></p>',
    '<p><span style="color:#1F497D"><b>Hi</b></span><span style="color: rgb(31, 73, 125)"><b> there</b></span></p>'
  ])('gives one span, stable when loaded again: %s', html => {
    const first = load(html)
    expect(first).toBe(
      '<p><span style="color: rgb(31, 73, 125);"><strong>Hi there</strong></span></p>'
    )
    expect(load(first)).toBe(first)
  })

  it('gives one span for background colours spelled differently', () => {
    const first = load(
      '<p><span style="background-color:#FFFF00">a</span><span style="background-color:#ffff00">b</span></p>'
    )
    expect(first).toBe(
      '<p><span style="background-color: rgb(255, 255, 0);">ab</span></p>'
    )
    expect(load(first)).toBe(first)
  })

  it('drops a span whose only kept style the browser refuses', () => {
    const first = load('<p><span style="color: notacolour">a</span>b</p>')
    expect(first).toBe('<p>ab</p>')
    expect(load(first)).toBe(first)
  })
})
