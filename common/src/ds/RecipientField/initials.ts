const LETTER = /[A-Za-z]/

function firstLetter(word: string): string | null {
  return LETTER.exec(word.trim())?.[0] ?? null
}

/**
 * Two letters standing for a name or an address, as tmail-flutter writes
 * them (`firstLetterToUpperCase`): the first letters of the first two words,
 * else the first two letters of a single word, else its first character
 */
export function initialsOf(text: string): string {
  const words = text.split(' ')
  if (words.length > 1) {
    const first = firstLetter(words[0] ?? '')
    const second = firstLetter(words[1] ?? '')
    if (first !== null && second !== null) {
      return `${first}${second}`.toUpperCase()
    }
    const only = first ?? second
    return only === null ? '' : `${only}${only}`.toUpperCase()
  }
  const letters = text.trim().match(/[A-Za-z]/g) ?? []
  if (letters.length > 1) return `${letters[0]}${letters[1]}`.toUpperCase()
  return text.slice(0, text.length > 1 ? 2 : 1).toUpperCase()
}

/**
 * The parts of `text` around each occurrence of `query` (any case), the
 * matches flagged, as tmail-flutter's `RichTextWidget` highlights them
 */
export function splitMatches(
  text: string,
  query: string
): { text: string; isMatch: boolean }[] {
  const needle = query.toLowerCase()
  if (needle === '') return [{ text, isMatch: false }]
  const haystack = text.toLowerCase()
  const parts: { text: string; isMatch: boolean }[] = []
  let from = 0
  for (;;) {
    const start = haystack.indexOf(needle, from)
    if (start === -1) {
      if (from < text.length)
        parts.push({ text: text.slice(from), isMatch: false })
      return parts
    }
    if (start > from)
      parts.push({ text: text.slice(from, start), isMatch: false })
    parts.push({
      text: text.slice(start, start + needle.length),
      isMatch: true
    })
    from = start + needle.length
  }
}
