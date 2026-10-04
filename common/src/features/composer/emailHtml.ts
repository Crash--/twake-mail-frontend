/**
 * From the editor document to the HTML and the text of an email, and back.
 *
 * Mail clients ignore stylesheets and classes (Gmail drops `<style>` in the
 * body, Outlook renders with Word): everything the reader must see is an
 * inline style. The editor writes `<p>` with no margin; mail clients give
 * `<p>` a 1em margin, so lines become `<div>`, as Gmail, Thunderbird and
 * tmail-flutter (Summernote) write them.
 */

/** tmail-flutter's quote style (html_extension.dart, addBlockQuoteTag) */
export const BLOCKQUOTE_STYLE =
  'margin-left:8px;margin-right:8px;padding-left:12px;padding-right:12px;border-left:5px solid #eee;'

/** tmail-flutter's signature wrapper (html-editor-enhanced, insertSignature) */
export const SIGNATURE_CLASS = 'tmail-signature'
const SIGNATURE_STYLE = 'clear: both; display: block;'

const LIST_STYLE = 'margin:0 0 0 0;padding-left:24px;'
const IMAGE_STYLE = 'max-width:100%;'
const TABLE_STYLE = 'border-collapse:collapse;'
const CELL_STYLE = 'border:1px solid #ccc;padding:4px 8px;vertical-align:top;'

const HTML_BLOCK_SELECTOR = '[data-html-block]'

function parse(html: string): HTMLElement {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
    .body
}

function rename(element: Element, tagName: string): HTMLElement {
  const renamed = element.ownerDocument.createElement(tagName)
  for (const attribute of Array.from(element.attributes)) {
    renamed.setAttribute(attribute.name, attribute.value)
  }
  renamed.append(...Array.from(element.childNodes))
  element.replaceWith(renamed)
  return renamed
}

function appendStyle(element: Element, style: string): void {
  const current = element.getAttribute('style') ?? ''
  const separator = current === '' || current.trim().endsWith(';') ? '' : ';'
  element.setAttribute('style', `${current}${separator}${style}`)
}

function isInsideHtmlBlock(element: Element): boolean {
  return (element.parentElement?.closest(HTML_BLOCK_SELECTOR) ?? null) !== null
}

/** The editor's elements, not the ones of a kept HTML block */
function editorElements(root: HTMLElement, selector: string): Element[] {
  return Array.from(root.querySelectorAll(selector)).filter(
    element => !isInsideHtmlBlock(element)
  )
}

/**
 * The HTML body of an email, from the editor HTML (`editor.getHTML()`):
 *
 * - `<p>` become `<div>`, empty ones `<div><br></div>`;
 * - list items lose their inner `<p>`, lists and quotes get inline styles;
 * - images with a `data-reference` (a Content-ID) point to `cid:`;
 * - the signature block gets tmail-flutter's `tmail-signature` wrapper, so
 *   that tmail-flutter recognizes it in a draft or a reply;
 * - kept HTML blocks (quoted email, signature) are not touched.
 */
export function toEmailHtml(editorHtml: string): string {
  const root = parse(editorHtml)

  for (const item of editorElements(root, 'li')) {
    const paragraphs = Array.from(item.children).filter(
      child => child.tagName === 'P'
    )
    paragraphs.forEach((paragraph, index) => {
      if (index > 0) paragraph.before(root.ownerDocument.createElement('br'))
      paragraph.replaceWith(...Array.from(paragraph.childNodes))
    })
  }
  for (const paragraph of editorElements(root, 'p')) {
    const line = rename(paragraph, 'div')
    if (line.textContent === '' && line.querySelector('img, br') === null) {
      line.append(root.ownerDocument.createElement('br'))
    }
  }
  for (const list of editorElements(root, 'ul, ol')) {
    appendStyle(list, LIST_STYLE)
  }
  for (const table of editorElements(root, 'table')) {
    appendStyle(table, TABLE_STYLE)
    table.querySelectorAll('colgroup').forEach(group => group.remove())
  }
  for (const cell of editorElements(root, 'td, th')) {
    appendStyle(cell, CELL_STYLE)
    cell.removeAttribute('colspan')
    cell.removeAttribute('rowspan')
  }
  for (const quote of editorElements(root, 'blockquote')) {
    appendStyle(quote, BLOCKQUOTE_STYLE)
  }
  for (const image of editorElements(root, 'img')) {
    const reference = image.getAttribute('data-reference')
    if (reference) image.setAttribute('src', `cid:${reference}`)
    image.removeAttribute('data-reference')
    appendStyle(image, IMAGE_STYLE)
  }
  for (const signature of Array.from(
    root.querySelectorAll('[data-html-block="signature"]')
  )) {
    signature.classList.add(SIGNATURE_CLASS)
    signature.setAttribute('style', SIGNATURE_STYLE)
  }
  return root.innerHTML
}

/**
 * The editor HTML of an email body: `cid:` images of the editor's own
 * content get their display URL back and keep their Content-ID in
 * `data-reference`. Kept HTML blocks stay in their `cid:` form (they map
 * Content-IDs to URLs only when displayed).
 *
 * @param urlFor display URL of a Content-ID, null when unknown
 */
export function fromEmailHtml(
  html: string,
  urlFor: (cid: string) => string | null
): string {
  const root = parse(html)
  for (const image of editorElements(root, 'img')) {
    const src = image.getAttribute('src') ?? ''
    const reference =
      image.getAttribute('data-reference') ??
      (src.toLowerCase().startsWith('cid:') ? src.slice(4) : null)
    if (reference === null) continue
    image.setAttribute('data-reference', reference)
    const url = urlFor(reference)
    if (url !== null) image.setAttribute('src', url)
  }
  return root.innerHTML
}

/** Replaces `cid:` sources by display URLs, for a frame that shows HTML */
export function resolveCidSources(
  html: string,
  urlFor: (cid: string) => string | null
): string {
  return html.replace(/(["'])cid:([^"']+)\1/gi, (match, quote, cid) => {
    const url = urlFor(String(cid))
    return url === null ? match : `${String(quote)}${url}${String(quote)}`
  })
}

// --- text alternative -------------------------------------------------------

const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'CITE',
  'DIV',
  'DL',
  'FIELDSET',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TR',
  'UL'
])

const SKIPPED_TAGS = new Set(['STYLE', 'SCRIPT', 'HEAD', 'TITLE', 'META'])

interface TextContext {
  listCounters: (number | null)[]
}

/** Lines of text, without the quote prefix */
function collectLines(node: Node, context: TextContext, out: string[]): void {
  const pushText = (text: string): void => {
    const last = out.length - 1
    const current = out[last] ?? ''
    out[last] =
      current.trim() === ''
        ? `${current}${text.trimStart()}`
        : `${current}${text}`
  }
  const newLine = (): void => {
    if ((out[out.length - 1] ?? '') !== '') out.push('')
  }

  if (node.nodeType === Node.TEXT_NODE) {
    pushText((node.textContent ?? '').replace(/\s+/g, ' '))
    return
  }
  if (!(node instanceof Element) || SKIPPED_TAGS.has(node.tagName)) return

  const tag = node.tagName
  if (tag === 'BR') {
    out.push('')
    return
  }
  if (tag === 'IMG') {
    const alt = node.getAttribute('alt')
    if (alt) pushText(`[${alt}]`)
    return
  }
  if (tag === 'BLOCKQUOTE') {
    newLine()
    const inner: string[] = ['']
    for (const child of Array.from(node.childNodes)) {
      collectLines(child, { listCounters: [] }, inner)
    }
    const lines = trimEmptyLines(inner).map(line =>
      line === '' ? '>' : `> ${line}`
    )
    out.push(...lines, '')
    return
  }

  const isBlock = BLOCK_TAGS.has(tag)
  if (isBlock) newLine()
  if (tag === 'LI') {
    const counters = context.listCounters
    const depth = Math.max(counters.length - 1, 0)
    const counter = counters[counters.length - 1]
    const marker =
      counter === null || counter === undefined ? '-' : `${counter}.`
    if (typeof counter === 'number') counters[counters.length - 1] = counter + 1
    out[out.length - 1] = `${'  '.repeat(depth)}${marker} `
  }
  const childContext: TextContext =
    tag === 'UL' || tag === 'OL'
      ? {
          ...context,
          listCounters: [...context.listCounters, tag === 'OL' ? 1 : null]
        }
      : context
  for (const child of Array.from(node.childNodes)) {
    collectLines(child, childContext, out)
  }
  if (tag === 'A') {
    const href = node.getAttribute('href') ?? ''
    if (
      href !== '' &&
      href !== node.textContent &&
      !href.startsWith('mailto:')
    ) {
      pushText(` <${href}>`)
    }
  }
  if (tag === 'TD' || tag === 'TH') pushText(' ')
  if (isBlock) newLine()
}

function trimEmptyLines(lines: string[]): string[] {
  const trimmed = lines.map(line => line.replace(/[ \t]+$/g, ''))
  while (trimmed[0] === '') trimmed.shift()
  while (trimmed[trimmed.length - 1] === '') trimmed.pop()
  return trimmed.filter(
    (line, index) => !(line === '' && trimmed[index - 1] === '')
  )
}

/**
 * The `text/plain` alternative of an HTML body: paragraphs, `-` and `1.`
 * lists, `>` quotes, links as `text <url>`, images as `[alt]`.
 */
export function htmlToText(html: string): string {
  const root = parse(html)
  const lines: string[] = ['']
  collectLines(root, { listCounters: [] }, lines)
  return trimEmptyLines(lines).join('\n')
}
