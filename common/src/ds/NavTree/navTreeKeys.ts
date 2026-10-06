/**
 * The keys of a tree view (WAI-ARIA APG "Tree View", flat variant: the rows
 * are siblings in the DOM and carry `aria-level`), as pure functions over
 * the visible rows, so they are tested without a DOM.
 */

/** A visible row of a tree, in reading order */
export interface NavTreeRow {
  /** `aria-level`, 1 for the top level */
  level: number
  /** `aria-expanded`: null for a row without children */
  isExpanded: boolean | null
  /** What typeahead matches (the name of the row) */
  label: string
}

export type NavTreeKeyResult =
  /** Moves the focus to the row at this index */
  | { type: 'focus'; index: number }
  /** Expands or collapses the focused row */
  | { type: 'toggle' }
  /** Opens the focused row (its link) */
  | { type: 'open' }

/**
 * What a key does from the row at `current`, null when the key is not one
 * of the tree: the caller then leaves the event alone.
 */
export function resolveNavTreeKey(
  rows: readonly NavTreeRow[],
  current: number,
  key: string
): NavTreeKeyResult | null {
  const row = rows[current]
  if (row === undefined) return null
  const last = rows.length - 1
  switch (key) {
    case 'ArrowDown':
      return { type: 'focus', index: Math.min(current + 1, last) }
    case 'ArrowUp':
      return { type: 'focus', index: Math.max(current - 1, 0) }
    case 'Home':
      return { type: 'focus', index: 0 }
    case 'End':
      return { type: 'focus', index: last }
    case 'ArrowRight': {
      if (row.isExpanded === null) return null
      if (!row.isExpanded) return { type: 'toggle' }
      // Expanded: its first child, the next row when it is deeper
      const next = rows[current + 1]
      return next !== undefined && next.level > row.level
        ? { type: 'focus', index: current + 1 }
        : null
    }
    case 'ArrowLeft': {
      if (row.isExpanded === true) return { type: 'toggle' }
      // Collapsed or leaf: its parent, the closest row above one level up
      for (let index = current - 1; index >= 0; index -= 1) {
        const candidate = rows[index]
        if (candidate !== undefined && candidate.level < row.level) {
          return { type: 'focus', index }
        }
      }
      return null
    }
    case 'Enter':
      return { type: 'open' }
    default:
      return null
  }
}

/**
 * True for a key that adds a letter to the typeahead: a letter or a digit,
 * with no Ctrl, Alt or Meta. Punctuation (`/`, `?`, `#`) is not one, and
 * stays free for the shortcuts of the page.
 */
export function isTypeaheadKey(event: {
  key: string
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
}): boolean {
  return (
    /^[\p{L}\p{N}]$/u.test(event.key) &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey
  )
}

/**
 * The row a typeahead goes to: the first row (wrapping around) whose label
 * starts with `typed`. One letter, or the same letter typed again ("ccc"),
 * looks from the row after `current`, so it cycles through the rows
 * starting with it; a longer prefix looks from `current` itself and may stay
 * on it. -1 when no row matches.
 */
export function findTypeaheadMatch(
  rows: readonly NavTreeRow[],
  current: number,
  typed: string
): number {
  const needle = typed.toLocaleLowerCase()
  if (needle === '') return -1
  const first = needle.slice(0, 1)
  const isRepeat = Array.from(needle).every(letter => letter === first)
  const prefix = isRepeat ? first : needle
  const start = isRepeat ? current + 1 : current
  for (let step = 0; step < rows.length; step += 1) {
    const index = (start + step) % rows.length
    if (rows[index]?.label.toLocaleLowerCase().startsWith(prefix) === true) {
      return index
    }
  }
  return -1
}
