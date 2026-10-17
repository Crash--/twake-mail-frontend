// Upstream to twake-ui: with RichTextEditor. A quoted message the user
// edits like the rest of the text, as in tmail-flutter (Summernote), kept
// apart by its wrapper.
import { Extension, Node } from '@tiptap/core'
import type { ResolvedPos } from '@tiptap/pm/model'
import { TextSelection, type Transaction } from '@tiptap/pm/state'

import { HTML_BLOCK_ATTRIBUTE } from './htmlBlock'

/** The `data-html-block` kind of the wrapper of a quoted message */
export const QUOTE_BLOCK_KIND = 'quote'

/** Style of the cite line, block level in every mail client */
const CITE_STYLE = 'text-align: left;display: block;'

/** Depth of the innermost quote block holding `$position`, -1 for none */
function findQuoteDepth($position: ResolvedPos, name: string): number {
  for (let depth = $position.depth; depth > 0; depth -= 1) {
    if ($position.node(depth).type.name === name) return depth
  }
  return -1
}

function isInBlockquote($position: ResolvedPos, quoteDepth: number): boolean {
  for (let depth = $position.depth; depth > quoteDepth; depth -= 1) {
    if ($position.node(depth).type.name === 'blockquote') return true
  }
  return false
}

/**
 * Enter in the quoted text writes at the level of the message, not in the
 * quote: the quote is cut at the caret, and a paragraph goes between its two
 * halves, as tmail-flutter does. At an end of the quote, the paragraph goes
 * after (or before) it, without an empty half.
 */
export function exitQuote(
  tr: Transaction,
  shouldDispatch: boolean,
  name: string
): boolean {
  const { selection } = tr
  if (!(selection instanceof TextSelection) || !selection.empty) return false
  const $caret = selection.$from
  const quoteDepth = findQuoteDepth($caret, name)
  if (quoteDepth === -1 || !isInBlockquote($caret, quoteDepth)) return false
  const paragraph = tr.doc.type.schema.nodes.paragraph
  if (!paragraph) return false
  if (!shouldDispatch) return true

  // Out of the blocks the caret is at an end of: no empty half
  let depth = $caret.depth
  let position = $caret.pos
  const isAtEnd = position === $caret.end(depth)
  while (
    depth >= quoteDepth &&
    position === (isAtEnd ? $caret.end(depth) : $caret.start(depth))
  ) {
    position = isAtEnd ? $caret.after(depth) : $caret.before(depth)
    depth -= 1
  }
  // The blocks from the caret's to the quote, cut in two
  const splitDepth = depth - quoteDepth + 1
  if (splitDepth > 0) tr.split(position, splitDepth)
  const boundary = position + Math.max(splitDepth, 0)
  tr.insert(boundary, paragraph.create())
  tr.setSelection(TextSelection.create(tr.doc, boundary + 1))
  tr.scrollIntoView()
  return true
}

/** The header line of a quote ("On …, … wrote:"), right inside its wrapper */
export const QuoteCite = Node.create({
  name: 'quoteCite',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'cite', context: 'quoteBlock/' }]
  },

  renderHTML() {
    return ['cite', { style: CITE_STYLE }, 0]
  }
})

/**
 * A quoted message, editable: its wrapper `<div data-html-block="quote">`
 * stays around what the user changes in it, so that the message keeps
 * telling it apart (signature above it, its stylesheets confined to it).
 * Read before HtmlBlock, which would keep it whole and read only.
 */
export const QuoteBlock = Node.create({
  name: 'quoteBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [
      {
        tag: `div[${HTML_BLOCK_ATTRIBUTE}="${QUOTE_BLOCK_KIND}"]`,
        priority: 1001
      }
    ]
  },

  renderHTML() {
    return ['div', { [HTML_BLOCK_ATTRIBUTE]: QUOTE_BLOCK_KIND }, 0]
  }
})

/**
 * Enter in a quote ({@link exitQuote}), before the Enter of the lists and
 * paragraphs. Apart from QuoteBlock: a node of a higher priority would come
 * first in the schema, and fill the empty documents
 */
export const QuoteKeys = Extension.create({
  name: 'quoteKeys',
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) =>
        editor.commands.command(({ tr, dispatch }) =>
          exitQuote(tr, dispatch !== undefined, QuoteBlock.name)
        )
    }
  }
})
