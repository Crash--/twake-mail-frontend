// Upstream to twake-ui: yes, text helpers any list or avatar needs.
const segmenter =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null

/**
 * The characters of `text` as people see them: a letter with its accents,
 * a whole emoji (skin tone, family, flag), never cut apart
 */
export function graphemes(text: string): string[] {
  if (segmenter !== null) {
    return Array.from(segmenter.segment(text), ({ segment }) => segment)
  }
  // shortcut: without Intl.Segmenter (Firefox < 125) a letter keeps its
  // accents but an emoji sequence may be cut; drop once those are gone
  return text.match(/\P{M}\p{M}*|\p{M}+/gu) ?? []
}

/** Without accents nor case, however the accents are encoded */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}
