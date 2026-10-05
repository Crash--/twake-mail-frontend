import DOMPurify, {
  type Config,
  type UponSanitizeAttributeHookEvent
} from 'dompurify'

import { autolink, openInNewTab } from './autolink'
import { sanitizeDeclarations, sanitizeStyleSheet } from './sanitizeCss'

/**
 * Sanitization of the HTML of emails, aligned on tmail-flutter (ADR 0054,
 * its `sanitize_html` fork `support_mail`, and the DOM transformers it runs
 * after it): the same tags, attributes, URL schemes and CSS properties,
 * through DOMPurify. On top of it, remote content (images, backgrounds,
 * fonts) is blocked until the user allows it, which tmail-flutter does not
 * do.
 */

/** tmail-flutter `allowedTags`, SVG shapes included */
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'b', 'i', 'strong', 'em', 'a',
  'pre', 'code', 'img', 'tt', 'div', 'ins', 'del', 'sup', 'sub', 'p', 'ol',
  'ul', 'table', 'thead', 'tbody', 'tfoot', 'blockquote', 'dl', 'dt', 'dd',
  'kbd', 'q', 'samp', 'var', 'hr', 'ruby', 'rt', 'rp', 'li', 'tr', 'td', 'th',
  's', 'strike', 'summary', 'details', 'caption', 'figure', 'figcaption',
  'abbr', 'bdo', 'cite', 'dfn', 'mark', 'small', 'span', 'time', 'wbr',
  'font', 'u', 'center', 'section', 'colgroup', 'col', 'nav', 'main',
  'footer', 'style', 'svg', 'g', 'path', 'polygon', 'rect', 'circle',
  'ellipse', 'line', 'polyline', 'text'
] // prettier-ignore

/** tmail-flutter `alwaysAllowedAttributes` */
const GLOBAL_ATTRIBUTES = [
  'abbr', 'accept', 'accesskey', 'align', 'alt', 'aria-describedby',
  'aria-hidden', 'aria-label', 'aria-labelledby', 'axis', 'border',
  'cellpadding', 'cellspacing', 'char', 'charoff', 'checked', 'clear', 'cols',
  'colspan', 'color', 'compact', 'coords', 'datetime', 'dir', 'disabled',
  'for', 'frame', 'headers', 'height', 'hreflang', 'hspace', 'ismap', 'label',
  'lang', 'maxlength', 'media', 'multiple', 'name', 'nohref', 'noshade',
  'nowrap', 'open', 'prompt', 'readonly', 'rel', 'rev', 'rows', 'rowspan',
  'rules', 'scope', 'selected', 'shape', 'size', 'span', 'start', 'summary',
  'tabindex', 'title', 'type', 'usemap', 'valign', 'value', 'vspace',
  'width', 'itemprop', 'style', 'bgcolor', 'data-filename',
  'public-asset-id', 'data-mimetype'
] // prettier-ignore

/** Attributes allowed on some tags only (tmail-flutter `AttributePolicy`) */
const TAG_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  href: ['a'],
  src: ['img'],
  longdesc: ['img'],
  srcset: ['img'],
  cite: ['blockquote', 'del', 'ins', 'q'],
  itemscope: ['div'],
  itemtype: ['div']
}

/** Removed with their content */
const FORBIDDEN_TAGS = [
  'script', 'iframe', 'frame', 'frameset', 'embed', 'applet', 'base', 'link',
  'meta', 'input', 'button', 'textarea', 'select', 'option'
] // prettier-ignore

/** DOMPurify's default list, plus the form controls */
const FORBIDDEN_CONTENTS = [
  'annotation-xml', 'audio', 'colgroup', 'desc', 'foreignobject', 'head',
  'iframe', 'math', 'mi', 'mn', 'mo', 'ms', 'mtext', 'noembed', 'noframes',
  'noscript', 'plaintext', 'script', 'style', 'svg', 'template', 'thead',
  'title', 'video', 'xmp', 'button', 'textarea', 'select', 'option'
] // prettier-ignore

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9\-_:.]{0,63}$/
const CLASS_PATTERN = /^[A-Za-z][A-Za-z0-9\-_]{0,63}$/
/** tmail-flutter `base64ImagePattern`: raster images only, never SVG */
const DATA_IMAGE =
  /^data:image\/(png|jpeg|jpg|gif|bmp);base64,[A-Za-z0-9+/]+={0,2}$/

export interface SanitizeOptions {
  /** URL of each inline image (`cid:`), by Content-ID */
  inlineImageUrls?: ReadonlyMap<string, string>
  /**
   * Loads remote images, backgrounds and fonts. Off by default: they tell
   * the sender when and where the email is read (tracking pixels)
   */
  allowRemoteContent?: boolean
  /**
   * Turns the bare URLs and email addresses of the text into links, for the
   * reader (not for the quote of the composer, which keeps the original)
   */
  autolink?: boolean
}

export interface SanitizedEmailHtml {
  html: string
  /** Remote images, backgrounds and fonts left out */
  blockedRemoteContent: number
}

/** The Content-ID a `cid:` URL points at */
export function readCid(src: string): string {
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

/** Without whitespace nor control characters, which hide schemes */
function compactUrl(value: string): string {
  return Array.from(value)
    .filter(char => char.charCodeAt(0) > 0x20)
    .join('')
}

/** tmail-flutter `validLink`: http(s), mailto, or relative (anchors) */
function isValidLink(value: string): boolean {
  const url = compactUrl(value)
  if (url.startsWith('//')) return false
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase()
  return scheme === undefined || ['http', 'https', 'mailto'].includes(scheme)
}

type ImageSource = 'remote' | 'cid' | 'data' | 'invalid'

/** tmail-flutter `validImageSource`, relative URLs refused (they hit the app) */
function classifyImageSource(value: string): ImageSource {
  const url = compactUrl(value)
  if (/^https?:\/\//i.test(url)) return 'remote'
  if (/^cid:/i.test(url)) return 'cid'
  if (DATA_IMAGE.test(url)) return 'data'
  return 'invalid'
}

/** The state of one sanitization, read by the hooks */
interface Run {
  inlineImageUrls: ReadonlyMap<string, string>
  allowRemoteContent: boolean
  blockedRemoteContent: number
}

let run: Run | null = null

function currentRun(): Run {
  if (run === null) throw new Error('Email sanitization hook out of a run')
  return run
}

function isAllowedOnTag(attribute: string, tagName: string): boolean {
  const tags = TAG_ATTRIBUTES[attribute]
  return tags === undefined || tags.includes(tagName)
}

function filterClasses(value: string): string {
  return value
    .split(/\s+/)
    .filter(name => CLASS_PATTERN.test(name))
    .join(' ')
}

/** Keeps the `srcset` candidates that are allowed images */
function filterSrcset(value: string, state: Run): string {
  const candidates = value.split(',').map(candidate => candidate.trim())
  const kept = candidates.filter(candidate => {
    const [url = ''] = candidate.split(/\s+/)
    const source = classifyImageSource(url)
    if (source === 'remote' && !state.allowRemoteContent) {
      state.blockedRemoteContent += 1
      return false
    }
    return source === 'remote' || source === 'data'
  })
  return kept.join(', ')
}

function checkAttribute(
  node: Element,
  data: UponSanitizeAttributeHookEvent
): void {
  const state = currentRun()
  const tagName = node.tagName.toLowerCase()
  const { attrName, attrValue } = data
  if (!isAllowedOnTag(attrName, tagName)) {
    data.keepAttr = false
    return
  }
  if (/<\/?script/i.test(attrValue)) {
    data.keepAttr = false
    return
  }
  switch (attrName) {
    case 'id':
      data.keepAttr = ID_PATTERN.test(attrValue)
      return
    case 'class':
      data.attrValue = filterClasses(attrValue)
      data.keepAttr = data.attrValue !== ''
      return
    case 'href':
      data.keepAttr = isValidLink(attrValue)
      return
    case 'cite':
      data.keepAttr =
        isValidLink(attrValue) && !/^mailto:/i.test(compactUrl(attrValue))
      return
    case 'src':
    case 'longdesc':
      data.keepAttr = classifyImageSource(attrValue) !== 'invalid'
      return
    case 'srcset':
      data.attrValue = filterSrcset(attrValue, state)
      data.keepAttr = data.attrValue !== ''
      // DOMPurify does not know how to check a list of URLs: done above
      data.forceKeepAttr = data.keepAttr ? true : undefined
      return
    case 'style': {
      const { css, blockedRemoteContent } = sanitizeDeclarations(attrValue, {
        allowRemoteContent: state.allowRemoteContent
      })
      state.blockedRemoteContent += blockedRemoteContent
      data.attrValue = css
      data.keepAttr = css !== ''
      return
    }
    default:
  }
}

function sanitizeStyleElement(node: Node): void {
  if (!(node instanceof Element) || node.tagName.toLowerCase() !== 'style') {
    return
  }
  const state = currentRun()
  const { css, blockedRemoteContent } = sanitizeStyleSheet(node.textContent, {
    allowRemoteContent: state.allowRemoteContent
  })
  state.blockedRemoteContent += blockedRemoteContent
  node.textContent = css
}

/** What tmail-flutter's DOM transformers add once sanitized */
function finishElement(node: Element): void {
  const state = currentRun()
  const tagName = node.tagName.toLowerCase()
  if (tagName === 'a' && node.hasAttribute('href')) openInNewTab(node)
  if (tagName !== 'img') return
  const src = node.getAttribute('src')
  const source = src === null ? null : classifyImageSource(src)
  if (src !== null && source === 'cid') {
    const url = state.inlineImageUrls.get(normalizeCid(readCid(src.trim())))
    if (url) {
      node.setAttribute('src', url)
    } else {
      node.removeAttribute('src')
    }
  } else if (source === 'remote' && !state.allowRemoteContent) {
    node.removeAttribute('src')
    state.blockedRemoteContent += 1
  }
  if (node.hasAttribute('longdesc') && !state.allowRemoteContent) {
    node.removeAttribute('longdesc')
  }
  if (
    state.allowRemoteContent &&
    (source === 'remote' || node.hasAttribute('srcset'))
  ) {
    node.setAttribute('referrerpolicy', 'no-referrer')
    node.setAttribute('loading', 'lazy')
  }
}

const purifier = DOMPurify(window)
purifier.addHook('uponSanitizeElement', sanitizeStyleElement)
purifier.addHook('uponSanitizeAttribute', checkAttribute)
purifier.addHook('afterSanitizeAttributes', finishElement)

const CONFIG: Config & { RETURN_DOM_FRAGMENT: true } = {
  RETURN_DOM_FRAGMENT: true,
  // Keeps the <style> elements of the <head> and those before any content
  FORCE_BODY: true,
  ALLOWED_TAGS,
  ALLOWED_ATTR: [
    ...GLOBAL_ATTRIBUTES,
    ...Object.keys(TAG_ATTRIBUTES),
    'id',
    'class'
  ],
  FORBID_TAGS: FORBIDDEN_TAGS,
  FORBID_CONTENTS: FORBIDDEN_CONTENTS,
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false
}

/**
 * Sanitizes the HTML of an email for display: no script, no event handler,
 * no form, links opening a new tab without access to the app, CSS filtered,
 * `cid:` images pointing at their downloaded parts, and remote content left
 * out unless `allowRemoteContent`.
 */
export function sanitizeEmailHtml(
  html: string,
  {
    inlineImageUrls = new Map(),
    allowRemoteContent = false,
    autolink: withAutolink = false
  }: SanitizeOptions = {}
): SanitizedEmailHtml {
  run = { inlineImageUrls, allowRemoteContent, blockedRemoteContent: 0 }
  try {
    const content = purifier.sanitize(html, CONFIG)
    // On the sanitized DOM: the links it adds are built, never parsed
    if (withAutolink) autolink(content)
    const container = document.createElement('div')
    container.append(content)
    return {
      html: container.innerHTML,
      blockedRemoteContent: run.blockedRemoteContent
    }
  } finally {
    run = null
  }
}
