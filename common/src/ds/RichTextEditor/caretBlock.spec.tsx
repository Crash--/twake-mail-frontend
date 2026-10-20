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
  it('marks the top level block holding the caret and its two neighbours on each side, and follows it', () => {
    const editor = makeEditor(
      '<p>One</p><p>Two</p><p>Three</p><p>Four</p><p>Five</p><p>Six</p>'
    )
    editor.commands.setTextSelection(2)
    expect(caretBlockTexts(editor)).toEqual(['One', 'Two', 'Three'])

    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    expect(caretBlockTexts(editor)).toEqual(['Four', 'Five', 'Six'])
    editor.destroy()
  })

  it('marks the block that Enter creates', () => {
    const editor = makeEditor(
      '<p>Far</p><p>Before</p><p>Near</p><p>First line</p>'
    )
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.commands.splitBlock()

    const blocks = editor.view.dom.children
    expect(blocks).toHaveLength(5)
    expect(blocks[1]?.hasAttribute(CARET_BLOCK_ATTRIBUTE)).toBe(false)
    expect(blocks[4]?.hasAttribute(CARET_BLOCK_ATTRIBUTE)).toBe(true)
    editor.destroy()
  })

  it('marks the top level block, not the nested one', () => {
    const editor = makeEditor('<ul><li><p>Item</p></li></ul>')
    editor.commands.setTextSelection(4)

    const list = editor.view.dom.querySelector('ul')
    expect(list?.hasAttribute(CARET_BLOCK_ATTRIBUTE)).toBe(true)
    expect(list?.querySelector(`[${CARET_BLOCK_ATTRIBUTE}]`)).toBe(null)
    editor.destroy()
  })

  it('marks both ends of a selection across blocks, not the ones between', () => {
    const editor = makeEditor(
      '<p>1</p><p>2</p><p>3</p><p>4</p><p>5</p><p>6</p><p>7</p><p>8</p>'
    )
    const { doc } = editor.state
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(doc, 2, doc.content.size - 1)
      )
    )

    expect(caretBlockTexts(editor)).toEqual(['1', '2', '3', '6', '7', '8'])
    editor.destroy()
  })
})
