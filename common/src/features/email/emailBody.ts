import type { EmailBodyPart, EmailBodyValue } from 'jmap-client-ts'

import {
  FOCUS_RING_WIDTH,
  type FocusIndicator
} from '@/ds/FocusIndicator/focusIndicator'

import { autolink } from './autolink'
import {
  normalizeCid,
  readCid,
  sanitizeEmailHtml,
  type SanitizedEmailHtml,
  type SanitizeOptions
} from './sanitizeEmailHtml'

/**
 * Turns the body of an email into the document of the sandboxed iframe that
 * displays it. Defence in depth:
 *
 * 1. `sanitizeEmailHtml` keeps the tags, attributes and CSS tmail-flutter
 *    keeps (ADR 0054), and leaves remote content out until allowed;
 * 2. the iframe has no `allow-scripts` (see `EmailBodyFrame`);
 * 3. the document forbids scripts, plugins and frames by CSP, and remote
 *    images and fonts until the user allows them; once allowed, no referrer
 *    is sent.
 */

/** Id of the element wrapping the content, measured to size the iframe */
export const EMAIL_CONTENT_ID = 'tmail-content'

function contentSecurityPolicy(allowRemoteContent: boolean): string {
  const remote = allowRemoteContent ? ' https: http:' : ''
  return [
    "default-src 'none'",
    `img-src data: blob:${remote}`,
    "style-src 'unsafe-inline'",
    `font-src data:${remote}`
  ].join('; ')
}

// The stylesheet of the email document, not of the app: twake-mui does not
// reach inside the iframe. Images never overflow the reading pane, as in
// tmail-flutter (EML-04). Its text style too (`HtmlTemplate.defaultFontStyle`):
// Regular 14 in black, the default line height, paragraphs without margins.
const EMAIL_DOCUMENT_CSS = `
html, body { margin: 0; padding: 0; }
body {
  font-family: Inter, Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: normal;
  color: #000000;
  overflow-wrap: anywhere;
  overflow-y: hidden;
}
#${EMAIL_CONTENT_ID} { overflow-x: auto; }
img { max-width: 100%; height: auto; }
p { margin: 0; }
pre, .tmail-plain-text { white-space: pre-wrap; font-family: inherit; margin: 0; }
blockquote { margin: 0 0 0 8px; padding-left: 8px; border-left: 2px solid #c4c4c4; }
details.tmail-quoted-history > summary {
  display: inline-flex; align-items: center; justify-content: center; gap: 3px;
  width: 32px; height: 20px; margin: 8px 0 8px 4px; border-radius: 10px;
  background: #e3e7ee; cursor: pointer; list-style: none;
}
details.tmail-quoted-history > summary::-webkit-details-marker { display: none; }
details.tmail-quoted-history > summary:hover { background: #cdd3dc; }
details.tmail-quoted-history > summary > span { width: 4px; height: 4px; border-radius: 50%; background: #55687d; }
`

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Plain text as HTML, line breaks and spaces kept */
export function plainTextToHtml(text: string): string {
  return `<div class="tmail-plain-text">${escapeHtml(text)}</div>`
}

/**
 * Plain text as HTML for the reader: line breaks and spaces kept, URLs and
 * email addresses turned into links. Built with the DOM, the text never
 * parsed as HTML
 */
export function plainTextToLinkedHtml(text: string): string {
  const container = document.createElement('div')
  container.className = 'tmail-plain-text'
  container.textContent = text
  autolink(container)
  return container.outerHTML
}

/** The Content-IDs an HTML body references with `cid:` URLs */
export function findReferencedCids(html: string): Set<string> {
  const cids = new Set<string>()
  for (const match of html.matchAll(/cid:([^"'\s)>]+)/gi)) {
    if (match[1]) cids.add(normalizeCid(readCid(`cid:${match[1]}`)))
  }
  return cids
}

/**
 * The displayable content of the body parts JMAP selected for an HTML view
 * (`htmlBody`), for the reader: HTML parts sanitized, text parts escaped,
 * bare URLs and email addresses of both turned into links.
 */
export function renderBodyParts(
  parts: readonly EmailBodyPart[],
  bodyValues: Readonly<Record<string, EmailBodyValue>>,
  options: SanitizeOptions = {}
): SanitizedEmailHtml {
  let blockedRemoteContent = 0
  const html = parts
    .map(part => {
      const value = part.partId === null ? undefined : bodyValues[part.partId]
      if (!value) return ''
      if (part.type === 'text/html') {
        const sanitized = sanitizeEmailHtml(value.value, {
          ...options,
          autolink: true
        })
        blockedRemoteContent += sanitized.blockedRemoteContent
        return sanitized.html
      }
      if (part.type.startsWith('text/')) {
        return plainTextToLinkedHtml(value.value)
      }
      return ''
    })
    .join('')
  return { html, blockedRemoteContent }
}

/** The raw HTML of the body, to find the inline images it references */
export function joinHtmlValues(
  parts: readonly EmailBodyPart[],
  bodyValues: Readonly<Record<string, EmailBodyValue>>
): string {
  return parts
    .filter(part => part.type === 'text/html' && part.partId !== null)
    .map(part => bodyValues[part.partId ?? '']?.value ?? '')
    .join('')
}

export interface EmailDocumentOptions {
  /** Lets the CSP load the remote images and fonts the content kept */
  allowRemoteContent?: boolean
  /** The focus indicator the user chose: the theme does not reach the frame */
  focusIndicator?: FocusIndicator
}

// The "•••" of the quoted history is the only control of the document
// (links excepted, which keep the outline of the browser), outlined as the
// theme does outside the frame
function focusCss(focusIndicator: FocusIndicator): string {
  return `details.tmail-quoted-history > summary:focus-visible { outline: ${String(FOCUS_RING_WIDTH[focusIndicator])}px solid #0a84ff; outline-offset: 2px; }`
}

/** The whole document of the iframe, around already sanitized content */
export function buildEmailDocument(
  sanitizedContent: string,
  {
    allowRemoteContent = false,
    focusIndicator = 'discreet'
  }: EmailDocumentOptions = {}
): string {
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(allowRemoteContent)}">`,
    '<meta name="referrer" content="no-referrer">',
    '<base target="_blank">',
    `<style>${EMAIL_DOCUMENT_CSS}${focusCss(focusIndicator)}</style>`,
    `</head><body><div id="${EMAIL_CONTENT_ID}">${sanitizedContent}</div></body></html>`
  ].join('')
}
