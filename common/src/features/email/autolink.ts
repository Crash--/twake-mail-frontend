import { find } from 'linkifyjs'

/**
 * Bare URLs and email addresses of an email body turned into links, on the
 * DOM of the already sanitized content (tmail-flutter
 * `AutolinkTextNodeTransformer`): only the text nodes are read, links are
 * built with the DOM API, never by writing HTML.
 *
 * linkifyjs finds the candidates (balanced parentheses, trailing
 * punctuation, top-level domains of email addresses); what becomes a link is
 * decided here: `http(s)://` URLs, `www.` hosts (opened in https) and email
 * addresses (`mailto:`), nothing else.
 */

/** Text in these elements is left as is */
const SKIPPED_TAGS: ReadonlySet<string> = new Set([
  'a',
  'script',
  'style',
  'textarea',
  'code',
  'svg'
])

const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set([
  'http:',
  'https:',
  'mailto:'
])

/** Closing quotes linkifyjs keeps at the end of a URL (`« https://… »`) */
const TRAILING_QUOTES = /[»”’›]+$/u

export interface AutolinkMatch {
  /** What the link shows, as written in the text */
  text: string
  href: string
  start: number
  end: number
}

/** The URL of a candidate, null when it must stay text */
function hrefOf(type: string, value: string): string | null {
  let candidate: string
  if (type === 'email') {
    candidate = `mailto:${value}`
  } else if (/^(https?|mailto):/i.test(value)) {
    candidate = value
  } else if (/^www\./i.test(value)) {
    candidate = `https://${value}`
  } else {
    return null
  }
  try {
    const url = new URL(candidate)
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

/** The links of a text: http(s) URLs, `www.` hosts and email addresses */
export function findLinks(text: string): AutolinkMatch[] {
  const matches: AutolinkMatch[] = []
  for (const found of find(text)) {
    const value = found.value.replace(TRAILING_QUOTES, '')
    const href = hrefOf(found.type, value)
    if (href === null) continue
    matches.push({
      text: value,
      href,
      start: found.start,
      end: found.start + value.length
    })
  }
  return matches
}

/** What every link of the reader gets: a new tab without access to the app */
export function openInNewTab(link: Element): void {
  link.setAttribute('target', '_blank')
  link.setAttribute('rel', 'noopener noreferrer')
}

function isSkipped(node: Node, root: Node): boolean {
  for (
    let parent = node.parentNode;
    parent !== null && parent !== root;
    parent = parent.parentNode
  ) {
    if (SKIPPED_TAGS.has(parent.nodeName.toLowerCase())) return true
  }
  return false
}

function linkifyTextNode(node: Text): void {
  const text = node.data
  const matches = findLinks(text)
  if (matches.length === 0) return
  const document = node.ownerDocument
  const fragment = document.createDocumentFragment()
  let position = 0
  for (const match of matches) {
    if (match.start > position) {
      fragment.append(text.slice(position, match.start))
    }
    const link = document.createElement('a')
    link.setAttribute('href', match.href)
    openInNewTab(link)
    link.textContent = match.text
    fragment.append(link)
    position = match.end
  }
  if (position < text.length) fragment.append(text.slice(position))
  node.replaceWith(fragment)
}

/**
 * Turns the bare URLs and email addresses of the text under `root` into
 * links; text already in a link, a script, a style sheet, a text area or
 * code is left as is.
 */
export function autolink(root: Element | DocumentFragment): void {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  // Collected first: replacing a node while walking would skip the next one
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node instanceof Text && !isSkipped(node, root)) textNodes.push(node)
  }
  textNodes.forEach(linkifyTextNode)
}
