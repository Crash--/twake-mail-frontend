import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

import { HtmlBlock, type HtmlBlockDisplay } from './htmlBlock'

function makeEditor(
  content: string,
  displayOf?: (kind: string) => HtmlBlockDisplay
): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ trailingNode: false }),
      displayOf ? HtmlBlock.configure({ displayOf }) : HtmlBlock
    ],
    content
  })
}

function blockAttributes(editor: Editor): Record<string, unknown> | null {
  let attributes: Record<string, unknown> | null = null
  editor.state.doc.descendants(node => {
    if (node.type.name === 'htmlBlock') attributes = node.attrs
    return attributes === null
  })
  return attributes
}

describe('HtmlBlock', () => {
  it('does not take the display from the content', () => {
    const editor = makeEditor(
      '<div data-html-block="x" data-html-block-display="inline">Hi</div>'
    )

    expect(blockAttributes(editor)).toMatchObject({
      kind: 'x',
      display: 'frame'
    })
    editor.destroy()
  })

  it('takes the display of a kind from its option', () => {
    const editor = makeEditor(
      '<div data-html-block="signature">Alice</div>',
      kind => (kind === 'signature' ? 'inline' : 'frame')
    )

    expect(blockAttributes(editor)).toMatchObject({
      kind: 'signature',
      display: 'inline'
    })
    expect(editor.getHTML()).toBe(
      '<div data-html-block="signature" data-html-block-display="inline">Alice</div>'
    )
    editor.destroy()
  })

  it('writes its HTML without loading its images in the page', () => {
    const editor = makeEditor(
      '<div data-html-block="x"><img src="https://tracker.example/pixel"></div>'
    )
    const createElement = jest.spyOn(document, 'createElement')

    expect(editor.getHTML()).toContain('https://tracker.example/pixel')
    expect(createElement).not.toHaveBeenCalledWith('div')
    createElement.mockRestore()
    editor.destroy()
  })
})
