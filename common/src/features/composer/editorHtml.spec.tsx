import { Editor } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import { TextStyleKit } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'

import { HtmlBlock } from '@/ds/RichTextEditor/htmlBlock'
import { InlineImage } from '@/ds/RichTextEditor/inlineImage'

import { getEditorHtml, getEditorStorageHtml } from './editorHtml'

const CONTENT =
  '<p>Hello <strong>bold <em>and italic</em></strong> <a href="https://example.com">link</a></p>' +
  '<ul><li><p>one</p></li><li><p>two</p></li></ul>' +
  '<table><tbody><tr><th>A</th><td>B</td></tr></tbody></table>' +
  '<blockquote><p>quoted</p></blockquote>' +
  '<p><img src="blob:http://localhost/abc" data-reference="cid1@x"></p>' +
  '<div data-html-block="quote"><table><tr><td>kept as is</td></tr></table></div>' +
  '<div data-html-block="signature" data-html-block-display="inline">-- <br>Alice</div>'

function makeEditor(content: string): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ trailingNode: false }),
      TextStyleKit,
      TableKit.configure({ table: { resizable: false } }),
      InlineImage,
      HtmlBlock
    ],
    content
  })
}

describe('getEditorHtml', () => {
  it('writes what editor.getHTML() writes', () => {
    const editor = makeEditor(CONTENT)
    expect(getEditorHtml(editor)).toBe(editor.getHTML())
    editor.destroy()
  })

  it('follows the document as it changes, reusing the blocks left alone', () => {
    const editor = makeEditor(CONTENT)
    const before = getEditorHtml(editor)
    editor.commands.insertContentAt(1, 'typed ')
    const after = getEditorHtml(editor)

    expect(after).toBe(editor.getHTML())
    expect(after).not.toBe(before)
    expect(after).toContain('<p>typed Hello')
    editor.commands.setContent('<p>other</p>')
    expect(getEditorHtml(editor)).toBe('<p>other</p>')
    editor.destroy()
  })

  it('gives the storage form once per document', () => {
    const editor = makeEditor(CONTENT)
    const first = getEditorStorageHtml(editor)
    expect(first).toContain('src="cid:cid1@x"')
    expect(getEditorStorageHtml(editor)).toBe(first)
    editor.commands.insertContentAt(1, 'x')
    expect(getEditorStorageHtml(editor)).not.toBe(first)
    editor.destroy()
  })
})
