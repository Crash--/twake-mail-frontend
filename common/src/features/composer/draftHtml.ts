import { DRIVE_CARD_BLOCK } from '@common/features/drive/driveCard'
import { findReferencedCids } from '@common/features/email/emailBody'
import { sanitizeEmailHtml } from '@common/features/email/sanitizeEmailHtml'

import type { HtmlBlockDisplay } from '@/ds/RichTextEditor/htmlBlock'

/**
 * The editor blocks this composer writes into an email body, by kind:
 * `inline` ones render in the page of the app, `quote` is edited as the rest
 * of the text (the editor's QuoteBlock)
 */
const KEPT_BLOCKS: ReadonlyMap<string, 'inline' | 'quote'> = new Map([
  ['signature', 'inline'],
  [DRIVE_CARD_BLOCK, 'inline'],
  ['quote', 'quote']
])

/**
 * How the composer shows a block parsed from HTML (HtmlBlock `displayOf`):
 * its signature and Drive cards in the page, anything else in a frame
 */
export function blockDisplay(kind: string): HtmlBlockDisplay {
  return KEPT_BLOCKS.get(kind) === 'inline' ? 'inline' : 'frame'
}

const BLOCK_ATTRIBUTE = 'data-html-block'
const DISPLAY_ATTRIBUTE = 'data-html-block-display'
/** Marks a kept block across the sanitizer, which drops `data-*` */
const MARKER_PREFIX = 'twake-mail-kept-block-'

/** The kind of an editor block, null for none or an unknown one */
function keptKind(element: Element): string | null {
  const kind = element.getAttribute(BLOCK_ATTRIBUTE)
  return kind !== null && KEPT_BLOCKS.has(kind) ? kind : null
}

function parse(html: string): HTMLElement {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
    .body
}

/** The HTML with its kept blocks marked by a class, and nothing else */
function markKeptBlocks(html: string, isForeign: boolean): string {
  const root = parse(html)
  root.querySelectorAll(`[${BLOCK_ATTRIBUTE}]`).forEach(element => {
    const kind = keptKind(element)
    // The blocks of someone else's email are its content (its signature is
    // not the user's): only its quote keeps its wrapper
    if (kind !== null && (!isForeign || KEPT_BLOCKS.get(kind) === 'quote')) {
      element.classList.add(`${MARKER_PREFIX}${kind}`)
    }
    element.removeAttribute(BLOCK_ATTRIBUTE)
    element.removeAttribute(DISPLAY_ATTRIBUTE)
  })
  return root.innerHTML
}

/** The marked blocks back to editor blocks, their display set by their kind */
function restoreKeptBlocks(html: string): string {
  const root = parse(html)
  KEPT_BLOCKS.forEach((display, kind) => {
    const marker = `${MARKER_PREFIX}${kind}`
    root.querySelectorAll(`.${marker}`).forEach(element => {
      element.classList.remove(marker)
      if (element.classList.length === 0) element.removeAttribute('class')
      element.setAttribute(BLOCK_ATTRIBUTE, kind)
      if (display === 'inline') {
        element.setAttribute(DISPLAY_ATTRIBUTE, 'inline')
        // Rendered in the page: its style sheets would restyle the app
        element.querySelectorAll('style').forEach(style => {
          style.remove()
        })
      }
    })
  })
  return root.innerHTML
}

/**
 * The body of a draft, a template or an email edited as new, as the
 * composer may open it: sanitized as a quoted email (its `cid:` images and
 * remote images kept, the reader's rules otherwise), its own blocks
 * (signature, Drive cards, quote) given back from an allow-list, their
 * display set by their kind and never read from the content. With
 * `isForeign` (someone else's email), only the quote stays a block.
 */
export function sanitizeDraftHtml(
  html: string,
  { isForeign = false }: { isForeign?: boolean } = {}
): string {
  const keepCids = new Map(
    Array.from(findReferencedCids(html), cid => [cid, `cid:${cid}`])
  )
  const sanitized = sanitizeEmailHtml(markKeptBlocks(html, isForeign), {
    inlineImageUrls: keepCids,
    allowRemoteContent: true
  }).html
  return restoreKeptBlocks(sanitized)
}
