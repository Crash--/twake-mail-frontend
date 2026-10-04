// Cases adapted from Messages (suitenumerique/messages,
// smart-trailing-block.test.ts), MIT License, Copyright (c) 2025 Direction
// Interministérielle du Numérique - Gouvernement Français.
import { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'

import { HtmlBlock } from './htmlBlock'
import {
  ensureEditableBlock,
  findTrailingBlock,
  SmartTrailingBlock
} from './smartTrailingBlock'

function isFooter(node: ProseMirrorNode): boolean {
  return node.type.name === 'htmlBlock' && node.attrs.kind !== 'other'
}

const SIGNATURE = '<div data-html-block="signature">-- Me</div>'
const QUOTE = '<div data-html-block="quote"><blockquote>Hi</blockquote></div>'

function makeEditor(content: string): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ trailingNode: false }),
      HtmlBlock,
      SmartTrailingBlock.configure({ isFooter })
    ],
    content
  })
}

describe('findTrailingBlock', () => {
  it('ends the editable content before the first footer block', () => {
    const editor = makeEditor(`<p>Hello</p>${SIGNATURE}${QUOTE}`)
    const info = findTrailingBlock(editor.state.doc, isFooter)

    // <p>Hello</p>: 5 characters plus the paragraph's two boundaries
    expect(info).toEqual({ editableEnd: 7, needsParagraph: false })
    editor.destroy()
  })

  it('needs a paragraph when the content ends with something else than text', () => {
    const editor = makeEditor(`<ul><li><p>item</p></li></ul>${QUOTE}`)

    expect(findTrailingBlock(editor.state.doc, isFooter).needsParagraph).toBe(
      true
    )
    editor.destroy()
  })

  it('needs a paragraph when the footer comes first', () => {
    const editor = makeEditor(`${SIGNATURE}<p>after</p>`)

    expect(findTrailingBlock(editor.state.doc, isFooter)).toEqual({
      editableEnd: 0,
      needsParagraph: true
    })
    editor.destroy()
  })

  it('counts every block when there is no footer', () => {
    const editor = makeEditor('<p>One</p><p>Two</p>')

    expect(findTrailingBlock(editor.state.doc, isFooter)).toEqual({
      editableEnd: editor.state.doc.content.size,
      needsParagraph: false
    })
    editor.destroy()
  })
})

describe('SmartTrailingBlock', () => {
  it('gives a paragraph back above the footer once the text is deleted', () => {
    const editor = makeEditor(`<p>Hello</p>${SIGNATURE}`)
    const paragraphEnd = editor.state.doc.child(0).nodeSize

    editor.commands.deleteRange({ from: 0, to: paragraphEnd })

    const doc = editor.state.doc
    expect(doc.childCount).toBe(2)
    expect(doc.child(0).type.name).toBe('paragraph')
    expect(doc.child(1).attrs.kind).toBe('signature')
    editor.destroy()
  })

  it('leaves a document with something to type in alone', () => {
    const editor = makeEditor(
      `<p>Hello</p><div data-html-block="other">x</div>`
    )

    expect(
      ensureEditableBlock(editor.state.doc, editor.state.tr, isFooter)
    ).toBe(null)
    editor.destroy()
  })
})
