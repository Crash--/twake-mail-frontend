// Upstream to twake-ui: with RichTextEditor.
//
// Adapted from Messages (suitenumerique/messages,
// src/frontend/src/features/blocknote/smart-trailing-block.ts), MIT License,
// Copyright (c) 2025 Direction Interministérielle du Numérique - Gouvernement
// Français. Changes: a flat TipTap document (`doc > block*`) instead of
// BlockNote's `blockGroup > blockContainer`, and the footer blocks are told
// by an option instead of fixed block types.
import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import {
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type Transaction
} from '@tiptap/pm/state'

export interface SmartTrailingBlockOptions {
  /** Whether a top-level block belongs to the footer (signature, quote…) */
  isFooter: (node: ProseMirrorNode) => boolean
}

export interface TrailingBlockInfo {
  /** Where the editable content ends: before the first footer block */
  editableEnd: number
  /** The last editable block is not a text block (or there is none) */
  needsParagraph: boolean
}

/**
 * Where the editable content of `doc` ends, and whether typing there needs
 * a new paragraph: the footer blocks (and whatever follows the first one)
 * are not where the user writes.
 */
export function findTrailingBlock(
  doc: ProseMirrorNode,
  isFooter: (node: ProseMirrorNode) => boolean
): TrailingBlockInfo {
  let editableEnd = 0
  let lastEditable: ProseMirrorNode | null = null
  for (let index = 0; index < doc.childCount; index += 1) {
    const block = doc.child(index)
    if (isFooter(block)) break
    editableEnd += block.nodeSize
    lastEditable = block
  }
  return {
    editableEnd,
    needsParagraph: !lastEditable?.isTextblock
  }
}

/**
 * A paragraph at the start of a document made of footer blocks only, null
 * when the document has something to type in.
 */
export function ensureEditableBlock(
  doc: ProseMirrorNode,
  tr: Transaction,
  isFooter: (node: ProseMirrorNode) => boolean
): Transaction | null {
  const paragraph = doc.type.schema.nodes.paragraph
  if (!paragraph || doc.childCount === 0) return null
  for (let index = 0; index < doc.childCount; index += 1) {
    if (!isFooter(doc.child(index))) return null
  }
  return tr.insert(0, paragraph.create())
}

/**
 * Keeps somewhere to type above the footer blocks (signature, quoted
 * message) without an empty paragraph always trailing the document:
 *
 * - a click below the editable content (on the footer, or in the padding
 *   under it) puts the caret at the end of that content, creating an empty
 *   paragraph there when the content does not end with one (a table, an
 *   image block);
 * - after a tap there (touch, pen), the caret goes to the end of the
 *   editable content: the footer cannot hold it;
 * - a document left with footer blocks only gets a paragraph back above
 *   them.
 */
export const SmartTrailingBlock = Extension.create<SmartTrailingBlockOptions>({
  name: 'smartTrailingBlock',

  addOptions() {
    return { isFooter: () => false }
  },

  addProseMirrorPlugins() {
    const { isFooter } = this.options
    // Pointer type of the ongoing click, recorded outside ProseMirror: the
    // footer blocks' node views swallow the events raised inside them
    let lastPointerType = 'mouse'

    return [
      new Plugin({
        key: new PluginKey('smartTrailingBlock'),
        view: editorView => {
          const container = editorView.dom.parentElement
          const handlePointerDown = (event: PointerEvent): void => {
            lastPointerType = event.pointerType
          }
          container?.addEventListener('pointerdown', handlePointerDown, true)
          return {
            destroy: () => {
              container?.removeEventListener(
                'pointerdown',
                handlePointerDown,
                true
              )
            }
          }
        },
        props: {
          handleDOMEvents: {
            click: (view, event) => {
              // The controls of a block (its edit button) do their own thing
              // Not `instanceof`: the editor may be in another document
              const target = event.target as Element | null
              if (
                target?.nodeType === Node.ELEMENT_NODE &&
                target.closest('button, a, input') !== null
              ) {
                return false
              }
              const info = findTrailingBlock(view.state.doc, isFooter)
              const position = view.posAtCoords({
                left: event.clientX,
                top: event.clientY
              })
              // A click in the editable content: ProseMirror's business
              if (position && position.pos < info.editableEnd) return false
              // A click on a footer when the content ends with a text
              // block: the mouse selects that block (Delete removes it)
              if (!info.needsParagraph && lastPointerType === 'mouse') {
                return false
              }
              const { tr, schema } = view.state
              const paragraph = schema.nodes.paragraph
              if (info.needsParagraph && paragraph) {
                tr.insert(info.editableEnd, paragraph.create())
                tr.setSelection(
                  TextSelection.create(tr.doc, info.editableEnd + 1)
                )
              } else {
                tr.setSelection(
                  Selection.near(tr.doc.resolve(info.editableEnd), -1)
                )
              }
              view.dispatch(tr.scrollIntoView())
              view.focus()
              return true
            }
          }
        },
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some(transaction => transaction.docChanged)) {
            return null
          }
          return ensureEditableBlock(newState.doc, newState.tr, isFooter)
        }
      })
    ]
  }
})
