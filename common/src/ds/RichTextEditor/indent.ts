// Upstream to twake-ui: with RichTextEditor. TipTap has no indentation for
// paragraphs: this one writes a `margin-left` on the block, as Summernote
// (tmail-flutter's editor) does, so that every mail client shows it.
import { Extension, type CommandProps } from '@tiptap/core'
import type { Attrs } from '@tiptap/pm/model'

/** One level of indentation, in px */
export const INDENT_STEP = 24
const MAX_LEVEL = 8
const INDENTABLE = ['paragraph', 'heading']

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      /** Indents the selected paragraphs and headings by one level */
      indentBlocks: () => ReturnType
      /** Takes one level of indentation off */
      outdentBlocks: () => ReturnType
    }
  }
}

function readLevel(element: HTMLElement): number {
  const margin = Number.parseFloat(element.style.marginLeft)
  if (Number.isNaN(margin) || margin <= 0) return 0
  return Math.min(MAX_LEVEL, Math.round(margin / INDENT_STEP))
}

export const Indent = Extension.create({
  name: 'indent',

  addGlobalAttributes() {
    return [
      {
        types: INDENTABLE,
        attributes: {
          indent: {
            default: 0,
            parseHTML: readLevel,
            renderHTML: attributes => {
              const level = Number(attributes.indent)
              return level > 0
                ? { style: `margin-left: ${level * INDENT_STEP}px` }
                : {}
            }
          }
        }
      }
    ]
  },

  addCommands() {
    const change =
      (delta: 1 | -1) =>
      () =>
      ({ state, tr, dispatch }: CommandProps) => {
        const { from, to } = state.selection
        const shifts: { position: number; attrs: Attrs }[] = []
        state.doc.nodesBetween(from, to, (node, position) => {
          if (!INDENTABLE.includes(node.type.name)) return true
          const level = Number(node.attrs.indent ?? 0)
          const next = Math.max(0, Math.min(MAX_LEVEL, level + delta))
          if (next !== level) {
            shifts.push({ position, attrs: { ...node.attrs, indent: next } })
          }
          return false
        })
        if (dispatch) {
          for (const { position, attrs } of shifts) {
            tr.setNodeMarkup(position, undefined, attrs)
          }
          dispatch(tr)
        }
        return shifts.length > 0
      }
    return {
      indentBlocks: change(1),
      outdentBlocks: change(-1)
    }
  }
})
