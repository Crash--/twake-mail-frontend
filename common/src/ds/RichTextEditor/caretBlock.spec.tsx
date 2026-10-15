import { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'

import { CARET_BLOCK_ATTRIBUTE, CaretBlock } from './caretBlock'

function makeEditor(content: string): Editor {
  return new Editor({
    extensions: [StarterKit, CaretBlock],
    content
  })
}

function caretBlockTexts(editor: Editor): string[] {
  return Array.from(
    editor.view.dom.querySelectorAll(`:scope > [${CARET_BLOCK_ATTRIBUTE}]`),
    block => block.textContent
  )
}

describe('CaretBlock', () => {
  it('marks the top level block holding the caret, and follows it', () => {
    const editor = makeEditor('<p>One</p><p>Two</p>')
    editor.commands.setTextSelection(2)
    expect(caretBlockTexts(editor)).toEqual(['One'])

    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    expect(caretBlockTexts(editor)).toEqual(['Two'])
    editor.destroy()
  })

  it('marks the block that Enter creates', () => {
    const editor = makeEditor('<p>First line</p>')
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.commands.splitBlock()

    const blocks = editor.view.dom.children
    expect(blocks).toHaveLength(2)
    expect(blocks[0]?.hasAttribute(CARET_BLOCK_ATTRIBUTE)).toBe(false)
    expect(blocks[1]?.hasAttribute(CARET_BLOCK_ATTRIBUTE)).toBe(true)
    editor.destroy()
  })

  it('marks the top level block, not the nested one', () => {
    const editor = makeEditor('<ul><li><p>Item</p></li></ul><p>After</p>')
    editor.commands.setTextSelection(4)

    const marked = editor.view.dom.querySelectorAll(
      `[${CARET_BLOCK_ATTRIBUTE}]`
    )
    expect(marked).toHaveLength(1)
    expect(marked[0]?.tagName).toBe('UL')
    editor.destroy()
  })

  it('marks both ends of a selection across blocks, not the ones between', () => {
    const editor = makeEditor('<p>One</p><p>Two</p><p>Three</p>')
    const { doc } = editor.state
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(doc, 2, doc.content.size - 1)
      )
    )

    expect(caretBlockTexts(editor)).toEqual(['One', 'Three'])
    editor.destroy()
  })
})
