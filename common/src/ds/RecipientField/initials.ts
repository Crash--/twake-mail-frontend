import { foldText as fold, graphemes } from '@/ds/graphemes/graphemes'

const LETTER = /\p{L}/u

function firstLetter(word: string): string | null {
  return LETTER.exec(word.trim())?.[0] ?? null
}

/**
 * Two letters standing for a name or an address, as tmail-flutter writes
 * them (`firstLetterToUpperCase`): the first letters of the first two words,
 * else the first two letters of a single word, else its first character
 */
export function initialsOf(text: string): string {
  // Any run of white space (doubled spaces, a no-break space) between words
  const words = text.trim().split(/\s+/u)
  if (words.length > 1) {
    const first = firstLetter(words[0] ?? '')
    const second = firstLetter(words[1] ?? '')
    if (first !== null && second !== null) {
      return `${first}${second}`.toUpperCase()
    }
    const only = first ?? second
    return only === null ? '' : `${only}${only}`.toUpperCase()
  }
  const letters = text.trim().match(/\p{L}/gu) ?? []
  if (letters.length > 1) return `${letters[0]}${letters[1]}`.toUpperCase()
  return text.slice(0, text.length > 1 ? 2 : 1).toUpperCase()
}

/**
 * The parts of `text` around each occurrence of `query` (any case, any
 * accent), the matches flagged, as tmail-flutter's `RichTextWidget`
 * highlights them. A part never cuts a character (a letter from its
 * accents, an emoji).
 */
export function splitMatches(
  text: string,
  query: string
): { text: string; isMatch: boolean }[] {
  const needle = fold(query)
  if (needle === '') return [{ text, isMatch: false }]
  const units = graphemes(text)
  // The folded text, and for each of its code units the unit it comes from
  let haystack = ''
  const unitAt: number[] = []
  const startOf: number[] = []
  units.forEach((unit, index) => {
    startOf.push(haystack.length)
    const folded = fold(unit)
    haystack += folded
    unitAt.push(...Array<number>(folded.length).fill(index))
  })
  const parts: { text: string; isMatch: boolean }[] = []
  const joined = (from: number, to: number): string =>
    units.slice(from, to).join('')
  let from = 0
  for (;;) {
    const start = haystack.indexOf(needle, startOf[from] ?? haystack.length)
    if (start === -1) {
      if (from < units.length)
        parts.push({ text: joined(from, units.length), isMatch: false })
      return parts
    }
    const first = unitAt[start] ?? units.length
    const last = (unitAt[start + needle.length - 1] ?? first) + 1
    if (first > from) parts.push({ text: joined(from, first), isMatch: false })
    parts.push({ text: joined(first, last), isMatch: true })
    from = last
  }
}
