// Upstream to twake-ui: with RichTextEditor.
import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type Selection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/** The attribute on the top level blocks that hold an end of the selection */
export const CARET_BLOCK_ATTRIBUTE = 'data-caret-block'

/** Where the top level block holding `position` starts, null between blocks */
function topLevelBlockStart(
  doc: ProseMirrorNode,
  position: number
): number | null {
  const resolved = doc.resolve(position)
  return resolved.depth === 0 ? null : resolved.before(1)
}

/** The top level blocks holding the ends of `selection`, decorated */
export function caretBlockDecorations(
  doc: ProseMirrorNode,
  selection: Selection
): DecorationSet {
  const starts = new Set(
    [selection.anchor, selection.head]
      .map(position => topLevelBlockStart(doc, position))
      .filter(start => start !== null)
  )
  const decorations = [...starts].map(start => {
    const block = doc.nodeAt(start)
    return Decoration.node(start, start + (block?.nodeSize ?? 0), {
      [CARET_BLOCK_ATTRIBUTE]: ''
    })
  })
  return DecorationSet.create(doc, decorations)
}

/**
 * Marks the top level blocks the selection ends in, so that the editor can
 * treat them apart from the others (they stay laid out while the others,
 * out of view, are skipped)
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
