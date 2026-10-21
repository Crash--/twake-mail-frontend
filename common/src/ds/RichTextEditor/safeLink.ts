import { PasteRule } from '@tiptap/core'
import Link from '@tiptap/extension-link'
import { Plugin, type EditorState, type Transaction } from '@tiptap/pm/state'

/**
 * Past this length a run without spaces is not a link: the tokenizer of
 * linkifyjs, which finds the links, takes a time that grows with the square
 * of such a run when it holds punctuation (a 50 000 character `a-a-…` froze
 * the tab for 30 s, issue #679)
 */
export const MAX_LINK_LENGTH = 2048

const OVERLONG_RUN = new RegExp(`\\S{${MAX_LINK_LENGTH + 1},}`, 'g')

function hasOverlongRun(text: string): boolean {
  OVERLONG_RUN.lastIndex = 0
  return OVERLONG_RUN.test(text)
}

/** The text with its overlong runs blanked, at the same offsets */
function blankOverlongRuns(text: string): string {
  return text.replace(OVERLONG_RUN, run => ' '.repeat(run.length))
}

function touchesOverlongRun(
  transactions: readonly Transaction[],
  state: EditorState
): boolean {
  let found = false
  transactions.forEach(transaction => {
    transaction.mapping.maps.forEach((map, index) => {
      const after = transaction.mapping.slice(index + 1)
      map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
        if (found) return
        const from = after.map(newStart, -1)
        const to = Math.min(after.map(newEnd, 1), state.doc.content.size)
        state.doc.nodesBetween(from, to, node => {
          if (found || !node.isTextblock) return !found
          found = hasOverlongRun(node.textContent)
          return false
        })
      })
    })
  })
  return found
}

/**
 * The link of tiptap, without looking for links in the overlong runs of
 * text: the paste rule skips them and still links the rest of the text,
 * the automatic link and the link of a URL pasted over a selection are not
 * looked for in a paragraph that holds one.
 */
export const SafeLink = Link.extend({
  addPasteRules() {
    return (this.parent?.() ?? []).map(rule => {
      const find = rule.find
      if (typeof find !== 'function') return rule
      return new PasteRule({
        find: (text, event) => find(blankOverlongRuns(text), event),
        handler: rule.handler
      })
    })
  },

  addProseMirrorPlugins() {
    return (this.parent?.() ?? []).map(plugin => {
      const { appendTransaction } = plugin.spec
      const handlePaste = plugin.spec.props?.handlePaste
      if (appendTransaction === undefined && handlePaste === undefined) {
        return plugin
      }
      return new Plugin({
        ...plugin.spec,
        appendTransaction:
          appendTransaction === undefined
            ? undefined
            : (transactions, oldState, newState) =>
                touchesOverlongRun(
                  transactions.filter(transaction => transaction.docChanged),
                  newState
                )
                  ? null
                  : appendTransaction.call(
                      plugin,
                      transactions,
                      oldState,
                      newState
                    ),
        props: {
          ...plugin.spec.props,
          handlePaste:
            handlePaste === undefined
              ? undefined
              : (view, event, slice) =>
                  hasOverlongRun(
                    slice.content.textBetween(0, slice.content.size, ' ')
                  )
                    ? false
                    : handlePaste.call(plugin, view, event, slice)
        }
      })
    })
  }
})
