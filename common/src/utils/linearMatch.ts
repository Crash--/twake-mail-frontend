/**
 * Global matching of a pattern in a linear time (ReDoS,
 * `docs/security/redos-audit.md`).
 *
 * A global regex tries every position of the text; when its first quantifier
 * runs over the same characters from each of them (`[a-z]+@…` in a long run
 * of letters without `@`), a failing text costs a time quadratic in its
 * length. Here the pattern is tried only where a match can start, and after
 * a failure the search resumes past the positions that fail for the same
 * reason. The matches are the ones the pattern made global finds.
 */
export interface MatchStarts {
  /** The first position at or after `from` where a match may start, or -1 */
  next: (from: number) => number
  /**
   * After the pattern failed at `start`: a position after it before which
   * no match starts
   */
  afterFailure: (start: number) => number
}

/**
 * The matches of `pattern` (sticky, `y`) in `text`, as `text.matchAll` finds
 * them with the same pattern made global. The pattern never matches an
 * empty string.
 */
export function matchAllFrom(
  text: string,
  pattern: RegExp,
  starts: MatchStarts
): RegExpExecArray[] {
  if (!pattern.sticky) throw new Error('matchAllFrom needs a sticky pattern')
  const matches: RegExpExecArray[] = []
  let start = starts.next(0)
  while (start !== -1 && start < text.length) {
    pattern.lastIndex = start
    const match = pattern.exec(text)
    if (match === null) {
      start = starts.next(Math.max(starts.afterFailure(start), start + 1))
    } else {
      matches.push(match)
      start = starts.next(Math.max(pattern.lastIndex, start + 1))
    }
  }
  return matches
}

/** `text` with each match of `matchAllFrom` replaced */
export function replaceAllFrom(
  text: string,
  pattern: RegExp,
  starts: MatchStarts,
  replacement: (match: RegExpExecArray) => string
): string {
  let result = ''
  let copied = 0
  for (const match of matchAllFrom(text, pattern, starts)) {
    result += text.slice(copied, match.index) + replacement(match)
    copied = match.index + match[0].length
  }
  return result + text.slice(copied)
}

/** The position of the next match of `pattern` (global) at or after `from` */
export function indexOfPattern(
  text: string,
  pattern: RegExp,
  from: number
): number {
  pattern.lastIndex = from
  return pattern.exec(text)?.index ?? -1
}

/**
 * Where the run of the characters `run` (sticky, as `/[a-z]*\/y`) starting
 * at `from` ends
 */
export function endOfRun(text: string, run: RegExp, from: number): number {
  run.lastIndex = from
  return run.exec(text) === null ? from : run.lastIndex
}
