/**
 * CSS of the emails, filtered as tmail-flutter does (its sanitize_html fork,
 * `css_sanitizer.dart`): an allow-list of properties, dangerous values
 * dropped, `url()` checked. Remote `url()` (images, fonts) are dropped too
 * unless the user allowed the remote content of the email.
 */

/** tmail-flutter `allowedCssProperties` (html_sanitize_config.dart) */
const ALLOWED_PROPERTIES: ReadonlySet<string> = new Set([
  'color',
  'background-color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant',
  'font-stretch',
  'line-height',
  'text-align',
  'text-decoration',
  'text-transform',
  'text-indent',
  'letter-spacing',
  'white-space',
  'word-wrap',
  'word-break',
  'overflow-wrap',
  'overflow',
  'overflow-x',
  'overflow-y',
  'text-overflow',
  'vertical-align',
  'direction',
  'unicode-bidi',
  'margin',
  'margin-left',
  'margin-right',
  'margin-top',
  'margin-bottom',
  'padding',
  'padding-left',
  'padding-right',
  'padding-top',
  'padding-bottom',
  'border',
  'border-style',
  'border-color',
  'border-width',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-radius',
  'border-collapse',
  'border-spacing',
  'box-sizing',
  'width',
  'min-width',
  'max-width',
  'height',
  'min-height',
  'max-height',
  'display',
  'table-layout',
  'caption-side',
  'empty-cells',
  'list-style',
  'list-style-type',
  'list-style-position',
  'list-style-image',
  'fill',
  'stroke',
  'stroke-width',
  'opacity',
  'box-shadow',
  'text-shadow',
  'flex',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'justify-content',
  'align-items',
  'align-content',
  'align-self',
  'flex-direction',
  'flex-wrap',
  'background',
  'background-image',
  'background-size',
  'background-position',
  'background-repeat'
])

const OVERFLOW_PROPERTIES: ReadonlySet<string> = new Set([
  'overflow',
  'overflow-x',
  'overflow-y'
])

const OVERFLOW_VALUES: ReadonlySet<string> = new Set([
  'hidden',
  'auto',
  'scroll',
  'visible',
  'inherit',
  'initial',
  'unset',
  'revert'
])

/** tmail-flutter `forbiddenCssStrings`, plus escapes that could hide them */
const FORBIDDEN_VALUE =
  /expression\(|javascript:|vbscript:|behavior|-moz-binding|-webkit-binding|\\/i

/** An inline image, as tmail-flutter accepts it (`base64ImagePattern`) */
const DATA_IMAGE =
  /^data:image\/(png|jpeg|jpg|gif|bmp);base64,[A-Za-z0-9+/]+={0,2}$/

/** Bounded, after ADR 0069 (ReDoS) */
const COMMENT = /\/\*[\s\S]{0,20000}?\*\//g
const URL_FUNCTION = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi

export interface CssOptions {
  /** Keeps `http(s)` URLs (images, fonts) */
  allowRemoteContent: boolean
}

export interface SanitizedCss {
  css: string
  /** Declarations or rules dropped because they load remote content */
  blockedRemoteContent: number
}

type UrlVerdict = 'safe' | 'remote' | 'unsafe'

function judgeUrl(url: string): UrlVerdict {
  const value = url.trim()
  if (DATA_IMAGE.test(value)) return 'safe'
  if (/^https?:\/\//i.test(value)) return 'remote'
  // Relative URLs would hit the app origin, protocol-relative ones anywhere
  return 'unsafe'
}

/** The verdict of the worst `url()` of a value */
function judgeUrls(value: string): UrlVerdict {
  let verdict: UrlVerdict = 'safe'
  for (const match of value.matchAll(URL_FUNCTION)) {
    const urlVerdict = judgeUrl(match[2] ?? '')
    if (urlVerdict === 'unsafe') return 'unsafe'
    if (urlVerdict === 'remote') verdict = 'remote'
  }
  // A url( the pattern could not read, e.g. unbalanced quotes
  const urlCount = (value.match(/url\(/gi) ?? []).length
  const readCount = Array.from(value.matchAll(URL_FUNCTION)).length
  return urlCount === readCount ? verdict : 'unsafe'
}

/** Splits on `separator` outside quotes and parentheses */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: string | null = null
  let start = 0
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (quote !== null) {
      if (char === quote) quote = null
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '(') {
      depth += 1
    } else if (char === ')') {
      depth = Math.max(0, depth - 1)
    } else if (char === separator && depth === 0) {
      parts.push(text.slice(start, index))
      start = index + 1
    }
  }
  parts.push(text.slice(start))
  return parts
}

/**
 * Filters the declarations of a `style` attribute or of a rule: allowed
 * properties only, safe values only. Returns `prop: value; …`.
 */
export function sanitizeDeclarations(
  declarations: string,
  { allowRemoteContent }: CssOptions
): SanitizedCss {
  const kept: string[] = []
  let blockedRemoteContent = 0
  for (const declaration of splitTopLevel(
    declarations.replace(COMMENT, ''),
    ';'
  )) {
    const colon = declaration.indexOf(':')
    if (colon === -1) continue
    const property = declaration.slice(0, colon).trim().toLowerCase()
    const value = declaration.slice(colon + 1).trim()
    if (!ALLOWED_PROPERTIES.has(property) || value === '') continue
    if (FORBIDDEN_VALUE.test(value) || value.startsWith('//')) continue
    if (/[<>{}]/.test(value)) continue
    if (
      OVERFLOW_PROPERTIES.has(property) &&
      !OVERFLOW_VALUES.has(value.replace(/\s*!important$/i, '').toLowerCase())
    ) {
      continue
    }
    const verdict = judgeUrls(value)
    if (verdict === 'unsafe') continue
    if (verdict === 'remote' && !allowRemoteContent) {
      blockedRemoteContent += 1
      continue
    }
    kept.push(`${property}: ${value}`)
  }
  return { css: kept.join('; '), blockedRemoteContent }
}

/** A `{ … }` block found at the top level of a stylesheet */
interface CssBlock {
  prelude: string
  body: string
}

/** Splits a stylesheet in its top-level blocks, null when unbalanced */
function readBlocks(css: string): CssBlock[] | null {
  const blocks: CssBlock[] = []
  let depth = 0
  let quote: string | null = null
  let preludeStart = 0
  let bodyStart = 0
  for (let index = 0; index < css.length; index++) {
    const char = css[index]
    if (quote !== null) {
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
    } else if (char === '{') {
      if (depth === 0) bodyStart = index + 1
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth < 0) return null
      if (depth === 0) {
        blocks.push({
          prelude: css.slice(preludeStart, bodyStart - 1),
          body: css.slice(bodyStart, index)
        })
        preludeStart = index + 1
      }
    } else if (char === ';' && depth === 0) {
      // A statement at-rule (`@import url(…);`, `@charset`): dropped
      preludeStart = index + 1
    }
  }
  return depth === 0 ? blocks : null
}

function sanitizeRules(
  css: string,
  options: CssOptions,
  nesting: number
): SanitizedCss {
  const blocks = readBlocks(css)
  if (blocks === null || nesting > 3) {
    return { css: '', blockedRemoteContent: 0 }
  }
  const rules: string[] = []
  let blockedRemoteContent = 0
  for (const { prelude, body } of blocks) {
    const selector = prelude.trim()
    if (selector === '' || /[<{}]/.test(selector)) continue
    if (/^@media\b/i.test(selector)) {
      const inner = sanitizeRules(body, options, nesting + 1)
      blockedRemoteContent += inner.blockedRemoteContent
      if (inner.css !== '') rules.push(`${selector} { ${inner.css} }`)
      continue
    }
    if (/^@font-face\b/i.test(selector)) {
      // Fonts are remote content
      if (!options.allowRemoteContent) {
        blockedRemoteContent += 1
        continue
      }
      const fontFace = sanitizeFontFace(body)
      if (fontFace !== '') rules.push(`@font-face { ${fontFace} }`)
      continue
    }
    // Every other at-rule (@keyframes, @supports, @page…)
    if (selector.startsWith('@')) continue
    const declarations = sanitizeDeclarations(body, options)
    blockedRemoteContent += declarations.blockedRemoteContent
    if (declarations.css !== '')
      rules.push(`${selector} { ${declarations.css} }`)
  }
  return { css: rules.join('\n'), blockedRemoteContent }
}

/** A font loaded from `https`, once the user allowed remote content */
function sanitizeFontFace(body: string): string {
  const kept: string[] = []
  for (const declaration of splitTopLevel(body.replace(COMMENT, ''), ';')) {
    const colon = declaration.indexOf(':')
    if (colon === -1) continue
    const property = declaration.slice(0, colon).trim().toLowerCase()
    const value = declaration.slice(colon + 1).trim()
    if (
      !['font-family', 'src', 'font-weight', 'font-style'].includes(property)
    ) {
      continue
    }
    if (FORBIDDEN_VALUE.test(value) || /[<>{}]/.test(value)) continue
    if (property === 'src') {
      const urls = Array.from(value.matchAll(URL_FUNCTION), match =>
        (match[2] ?? '').trim()
      )
      if (urls.length === 0 || !urls.every(url => /^https:\/\//i.test(url))) {
        continue
      }
    }
    kept.push(`${property}: ${value}`)
  }
  return kept.some(declaration => declaration.startsWith('src:'))
    ? kept.join('; ')
    : ''
}

/**
 * Filters the content of a `<style>` element: rules keep their selector and
 * their filtered declarations, `@media` blocks are filtered recursively,
 * every other at-rule is dropped (`@import`, `@font-face` unless remote
 * content is allowed…). `<` never survives, so the text cannot close its
 * `<style>` element.
 */
export function sanitizeStyleSheet(
  css: string,
  options: CssOptions
): SanitizedCss {
  const result = sanitizeRules(css.replace(COMMENT, ''), options, 0)
  // @import is never followed, but it is a remote stylesheet
  const blockedImports = options.allowRemoteContent
    ? 0
    : (css.match(/@import\b/gi) ?? []).length
  return {
    css: result.css.replaceAll('<', ''),
    blockedRemoteContent: result.blockedRemoteContent + blockedImports
  }
}
