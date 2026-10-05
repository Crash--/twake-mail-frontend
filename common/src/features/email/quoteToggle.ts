/**
 * Folds the quoted history of an email behind a "•••" button, as
 * tmail-flutter web does (`HtmlUtils.addQuoteToggle`). The frame of the body
 * runs no script: the button is the `<summary>` of a `<details>`, which the
 * browser opens and closes itself (Enter, Space, a click) and whose state it
 * tells screen readers; the frame follows the height of its content.
 */

/** Class of the `<details>` holding the quoted history */
export const QUOTED_HISTORY_CLASS = 'tmail-quoted-history'

/** The nodes of a quote, consecutive children of the same parent */
interface QuoteRange {
  first: ChildNode
  last: ChildNode
}

function single(element: Element): QuoteRange {
  return { first: element, last: element }
}

/** The element itself and everything after it in its parent */
function toEndOfParent(element: Element): QuoteRange {
  return {
    first: element,
    last: element.parentNode?.lastChild ?? element
  }
}

/**
 * tmail-flutter's rule: the last `blockquote` child of the content, or of a
 * `div` child, or of a `div` in a `div`, the first level having one winning
 */
function flutterBlockquote(body: HTMLElement): QuoteRange | null {
  const levels = [':scope > blockquote', ':scope > div > blockquote']
  levels.push(':scope > div > div > blockquote')
  for (const selector of levels) {
    const found = body.querySelectorAll(selector)
    const last = found[found.length - 1]
    if (last) return single(last)
  }
  return null
}

/** The quotes other mail clients write around the message they answer */
function clientQuotes(body: HTMLElement): QuoteRange[] {
  const ranges: QuoteRange[] = []
  // Gmail: the attribution line and the blockquote, in one div
  for (const quote of body.querySelectorAll('div.gmail_quote')) {
    if (!quote.parentElement?.closest('div.gmail_quote')) {
      ranges.push(single(quote))
    }
  }
  // Outlook: the header of the original ("From:, Sent:…") then the original,
  // after a rule
  for (const header of body.querySelectorAll('#divRplyFwdMsg')) {
    const rule = header.previousElementSibling
    ranges.push(toEndOfParent(rule?.tagName === 'HR' ? rule : header))
  }
  // Thunderbird: the attribution line, then the blockquote
  for (const prefix of body.querySelectorAll('div.moz-cite-prefix')) {
    const quote = prefix.nextElementSibling
    if (quote?.tagName === 'BLOCKQUOTE') {
      ranges.push({ first: prefix, last: quote })
    }
  }
  return ranges
}

function contains(outer: QuoteRange, inner: QuoteRange): boolean {
  let node: ChildNode | null = outer.first
  while (node !== null) {
    if (node === inner.first || node.contains(inner.first)) return true
    if (node === outer.last) return false
    node = node.nextSibling
  }
  return false
}

function startsAfter(left: QuoteRange, right: QuoteRange): boolean {
  return Boolean(
    right.first.compareDocumentPosition(left.first) &
    Node.DOCUMENT_POSITION_FOLLOWING
  )
}

/** Whether something is shown before the quote: text or an image */
function hasContentBefore(body: HTMLElement, quote: QuoteRange): boolean {
  const range = body.ownerDocument.createRange()
  range.setStart(body, 0)
  range.setEndBefore(quote.first)
  if (range.toString().trim() !== '') return true
  return range.cloneContents().querySelector('img') !== null
}

/** The last quote of the message, outside any other one */
function findQuotedHistory(body: HTMLElement): QuoteRange | null {
  const candidates = [flutterBlockquote(body), ...clientQuotes(body)].filter(
    (range): range is QuoteRange => range !== null
  )
  const outermost = candidates.filter(
    candidate =>
      !candidates.some(
        other => other !== candidate && contains(other, candidate)
      )
  )
  return outermost.reduce<QuoteRange | null>(
    (latest, candidate) =>
      latest === null || startsAfter(candidate, latest) ? candidate : latest,
    null
  )
}

/**
 * Sanitized HTML with its quoted history folded in a `<details>`, its
 * `<summary>` named `label` ("Show trimmed content"); unchanged without
 * one, or when the quote is all there is to read. Parsed in an inert
 * document: nothing loads.
 */
export function foldQuotedHistory(html: string, label: string): string {
  const parsed = new DOMParser().parseFromString(
    `<!doctype html><body>${html}</body>`,
    'text/html'
  )
  const { body } = parsed
  const quote = findQuotedHistory(body)
  if (quote === null || !hasContentBefore(body, quote)) return html

  const details = parsed.createElement('details')
  details.className = QUOTED_HISTORY_CLASS
  const summary = parsed.createElement('summary')
  summary.setAttribute('aria-label', label)
  summary.setAttribute('title', label)
  for (let dot = 0; dot < 3; dot += 1) {
    summary.append(parsed.createElement('span'))
  }
  details.append(summary)
  quote.first.before(details)
  let node: ChildNode | null = quote.first
  while (node !== null) {
    const next: ChildNode | null = node === quote.last ? null : node.nextSibling
    details.append(node)
    node = next
  }
  return body.innerHTML
}
