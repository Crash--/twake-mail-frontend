import DOMPurify from 'dompurify'
import type { EmailBodyPart, EmailBodyValue } from 'jmap-client-ts'

/**
 * Turns the body of an email into the document of the sandboxed iframe that
 * displays it. Defence in depth, as tmail-flutter (ADR 0054) sanitizes too:
 *
 * 1. DOMPurify removes scripts, event handlers, `javascript:` URLs, forms,
 *    `<base>`, `<meta>`, `<link>`…;
 * 2. the iframe has no `allow-scripts` (see `EmailBodyFrame`);
 * 3. the document forbids scripts, plugins and frames by CSP.
 */

/** Id of the element wrapping the content, measured to size the iframe */
export const EMAIL_CONTENT_ID = 'tmail-content'

const CONTENT_SECURITY_POLICY =
  "default-src 'none'; img-src * data: blob:; media-src * data: blob:; style-src 'unsafe-inline' *; font-src * data:"

// The stylesheet of the email document, not of the app: twake-mui does not
// reach inside the iframe. Images never overflow the reading pane, as in
// tmail-flutter (EML-04).
const EMAIL_DOCUMENT_CSS = `
html, body { margin: 0; padding: 0; }
body {
  font-family: Inter, Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #1b1b1f;
  overflow-wrap: anywhere;
  overflow-y: hidden;
}
#${EMAIL_CONTENT_ID} { overflow-x: auto; }
img { max-width: 100%; height: auto; }
pre, .tmail-plain-text { white-space: pre-wrap; font-family: inherit; margin: 0; }
blockquote { margin: 0 0 0 8px; padding-left: 8px; border-left: 2px solid #c4c4c4; }
`

const FORBIDDEN_TAGS = ['form', 'input', 'button', 'select', 'textarea']

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

function readCid(src: string): string {
  const reference = src.slice('cid:'.length)
  try {
    return decodeURIComponent(reference)
  } catch {
    return reference
  }
}

/** `<cid>` and `cid` both identify the part of Content-ID `<cid>` */
export function normalizeCid(cid: string): string {
  return cid.replace(/^<|>$/g, '')
}

/**
 * Sanitizes the HTML of an email: no script, no event handler, links open
 * in a new tab without access to the app, `cid:` images point at the URLs
 * of their downloaded parts.
 *
 * @param inlineImageUrls URL of each inline image, by Content-ID
 */
export function sanitizeEmailHtml(
  html: string,
  inlineImageUrls: ReadonlyMap<string, string> = new Map()
): string {
  const content = DOMPurify.sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
    // Keeps the <style> elements that come before any content
    FORCE_BODY: true,
    FORBID_TAGS: FORBIDDEN_TAGS
  })

  content.querySelectorAll('a[href]').forEach(link => {
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
  })
  content.querySelectorAll('img[src]').forEach(image => {
    const src = image.getAttribute('src') ?? ''
    if (!src.toLowerCase().startsWith('cid:')) return
    const url = inlineImageUrls.get(normalizeCid(readCid(src)))
    if (url) {
      image.setAttribute('src', url)
    } else {
      image.removeAttribute('src')
    }
  })
  const container = document.createElement('div')
  container.append(content)
  return container.innerHTML
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
 * (`htmlBody`): HTML parts sanitized, text parts escaped.
 */
export function renderBodyParts(
  parts: readonly EmailBodyPart[],
  bodyValues: Readonly<Record<string, EmailBodyValue>>,
  inlineImageUrls: ReadonlyMap<string, string> = new Map()
): string {
  return parts
    .map(part => {
      const value = part.partId === null ? undefined : bodyValues[part.partId]
      if (!value) return ''
      if (part.type === 'text/html') {
        return sanitizeEmailHtml(value.value, inlineImageUrls)
      }
      if (part.type.startsWith('text/')) return plainTextToHtml(value.value)
      return ''
    })
    .join('')
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

/** The whole document of the iframe, around already sanitized content */
export function buildEmailDocument(sanitizedContent: string): string {
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`,
    '<base target="_blank">',
    `<style>${EMAIL_DOCUMENT_CSS}</style>`,
    `</head><body><div id="${EMAIL_CONTENT_ID}">${sanitizedContent}</div></body></html>`
  ].join('')
}
