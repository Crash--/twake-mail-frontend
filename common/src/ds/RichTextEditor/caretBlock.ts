// Upstream to twake-ui: with RichTextEditor.
import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type Selection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/**
 * The attribute on the top level blocks that hold an end of the selection,
 * and on their neighbours
 */
export const CARET_BLOCK_ATTRIBUTE = 'data-caret-block'

/**
 * Blocks marked on each side of a caret block. Enter in a quote cuts it in
 * two around an answer and two empty lines (see quoteBlock): its first half
 * keeps the DOM of the whole quote, and, out of view, its size until laid
 * out again, which would put the caret thousands of pixels too low and
 * scroll there (#672).
 */
const NEIGHBOUR_COUNT = 2

/** The index of the top level block holding `position`, null between blocks */
function topLevelBlockIndex(
  doc: ProseMirrorNode,
  position: number
): number | null {
  const resolved = doc.resolve(position)
  return resolved.depth === 0 ? null : resolved.index(0)
}

/**
 * The top level blocks holding the ends of `selection` and their
 * neighbours, decorated
 */
export function caretBlockDecorations(
  doc: ProseMirrorNode,
  selection: Selection
): DecorationSet {
  const indexes = new Set(
    [selection.anchor, selection.head]
      .map(position => topLevelBlockIndex(doc, position))
      .filter(index => index !== null)
      .flatMap(index =>
        Array.from(
          { length: 2 * NEIGHBOUR_COUNT + 1 },
          (_, offset) => index - NEIGHBOUR_COUNT + offset
        )
      )
      .filter(index => index >= 0 && index < doc.childCount)
  )
  const decorations: Decoration[] = []
  doc.forEach((block, start, index) => {
    if (!indexes.has(index)) return
    decorations.push(
      Decoration.node(start, start + block.nodeSize, {
        [CARET_BLOCK_ATTRIBUTE]: ''
      })
    )
  })
  return DecorationSet.create(doc, decorations)
}

/**
 * Marks the top level blocks the selection ends in and their neighbours, so
 * that the editor can treat them apart from the others (they stay laid out
 * while the others, out of view, are skipped)
 */
export const CaretBlock = Extension.create({
  name: 'caretBlock',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('caretBlock'),
        props: {
          decorations: state =>
            caretBlockDecorations(state.doc, state.selection)
        }
      })
    ]
  }
})
