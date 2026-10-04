/** A piece of a search snippet: plain text, or text matching the search */
export interface SnippetSegment {
  text: string
  isMatch: boolean
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
}

const ENTITY = /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi

function decodeCodePoint(codePoint: number, entity: string): string {
  return Number.isInteger(codePoint) &&
    codePoint > 0 &&
    codePoint <= 0x10ffff &&
    (codePoint < 0xd800 || codePoint > 0xdfff)
    ? String.fromCodePoint(codePoint)
    : entity
}

/**
 * Decodes the character references of an HTML text: the server escapes the
 * subject and the preview before adding its `<mark>` tags. Unknown entities
 * stay as they are.
 */
export function decodeEntities(text: string): string {
  return text.replace(ENTITY, (entity, name: string) => {
    if (name.startsWith('#x') || name.startsWith('#X')) {
      return decodeCodePoint(Number.parseInt(name.slice(2), 16), entity)
    }
    if (name.startsWith('#')) {
      return decodeCodePoint(Number.parseInt(name.slice(1), 10), entity)
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? entity
  })
}

const MARK_TAG = /<(\/?)mark>/gi

/**
 * Splits a `SearchSnippet` (RFC 8621 §5: HTML-escaped text where the
 * matches are wrapped in `<mark>`) into text segments, to render as text and
 * never as HTML: any other tag, if a server did not escape it, shows as
 * typed (the "<Search snippets html escape>" scenario of tmail-flutter).
 */
export function parseSnippet(snippet: string): SnippetSegment[] {
  const segments: SnippetSegment[] = []
  let isMatch = false
  let start = 0
  const push = (raw: string): void => {
    if (raw === '') return
    const text = decodeEntities(raw)
    const last = segments[segments.length - 1]
    if (last?.isMatch === isMatch) {
      last.text += text
    } else {
      segments.push({ text, isMatch })
    }
  }
  for (const match of snippet.matchAll(MARK_TAG)) {
    push(snippet.slice(start, match.index))
    isMatch = match[1] !== '/'
    start = match.index + match[0].length
  }
  push(snippet.slice(start))
  return segments
}
