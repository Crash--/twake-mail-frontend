import {
  findTypeaheadMatch,
  isTypeaheadKey,
  resolveNavTreeKey,
  type NavTreeRow
} from './navTreeKeys'

function row(
  label: string,
  level = 1,
  isExpanded: boolean | null = null
): NavTreeRow {
  return { label, level, isExpanded }
}

// Inbox (expanded) > Work (collapsed), Sub; Starred; Drafts
const ROWS: NavTreeRow[] = [
  row('Inbox', 1, true),
  row('Work', 2, false),
  row('Sub', 2),
  row('Starred'),
  row('Drafts')
]

describe('resolveNavTreeKey', () => {
  it('moves to the next and previous rows, and stops at the ends', () => {
    expect(resolveNavTreeKey(ROWS, 1, 'ArrowDown')).toEqual({
      type: 'focus',
      index: 2
    })
    expect(resolveNavTreeKey(ROWS, 1, 'ArrowUp')).toEqual({
      type: 'focus',
      index: 0
    })
    expect(resolveNavTreeKey(ROWS, 4, 'ArrowDown')).toEqual({
      type: 'focus',
      index: 4
    })
    expect(resolveNavTreeKey(ROWS, 0, 'ArrowUp')).toEqual({
      type: 'focus',
      index: 0
    })
  })

  it('goes to the first and last rows with Home and End', () => {
    expect(resolveNavTreeKey(ROWS, 2, 'Home')).toEqual({
      type: 'focus',
      index: 0
    })
    expect(resolveNavTreeKey(ROWS, 2, 'End')).toEqual({
      type: 'focus',
      index: 4
    })
  })

  it('expands a collapsed row with ArrowRight', () => {
    expect(resolveNavTreeKey(ROWS, 1, 'ArrowRight')).toEqual({
      type: 'toggle'
    })
  })

  it('goes to the first child of an expanded row with ArrowRight', () => {
    expect(resolveNavTreeKey(ROWS, 0, 'ArrowRight')).toEqual({
      type: 'focus',
      index: 1
    })
  })

  it('does nothing with ArrowRight on a leaf', () => {
    expect(resolveNavTreeKey(ROWS, 2, 'ArrowRight')).toBe(null)
    expect(resolveNavTreeKey(ROWS, 3, 'ArrowRight')).toBe(null)
  })

  it('collapses an expanded row with ArrowLeft', () => {
    expect(resolveNavTreeKey(ROWS, 0, 'ArrowLeft')).toEqual({
      type: 'toggle'
    })
  })

  it('goes to the parent with ArrowLeft on a collapsed row or a leaf', () => {
    expect(resolveNavTreeKey(ROWS, 1, 'ArrowLeft')).toEqual({
      type: 'focus',
      index: 0
    })
    expect(resolveNavTreeKey(ROWS, 2, 'ArrowLeft')).toEqual({
      type: 'focus',
      index: 0
    })
  })

  it('does nothing with ArrowLeft on a top level row without children', () => {
    expect(resolveNavTreeKey(ROWS, 3, 'ArrowLeft')).toBe(null)
  })

  it('opens the row with Enter', () => {
    expect(resolveNavTreeKey(ROWS, 3, 'Enter')).toEqual({ type: 'open' })
  })

  it('leaves the other keys alone', () => {
    expect(resolveNavTreeKey(ROWS, 0, 'Escape')).toBe(null)
    expect(resolveNavTreeKey(ROWS, 0, 'Tab')).toBe(null)
    expect(resolveNavTreeKey(ROWS, 9, 'ArrowDown')).toBe(null)
  })
})

describe('isTypeaheadKey', () => {
  const plain = { ctrlKey: false, altKey: false, metaKey: false }

  it('accepts a letter, not a named key, a space or a shortcut', () => {
    expect(isTypeaheadKey({ key: 'd', ...plain })).toBe(true)
    expect(isTypeaheadKey({ key: 'D', ...plain })).toBe(true)
    expect(isTypeaheadKey({ key: 'ArrowDown', ...plain })).toBe(false)
    expect(isTypeaheadKey({ key: '4', ...plain })).toBe(true)
    expect(isTypeaheadKey({ key: ' ', ...plain })).toBe(false)
    // Left to the shortcuts of the page
    for (const key of ['/', '?', '#']) {
      expect(isTypeaheadKey({ key, ...plain })).toBe(false)
    }
    expect(isTypeaheadKey({ key: 'd', ...plain, ctrlKey: true })).toBe(false)
  })
})

describe('findTypeaheadMatch', () => {
  const rows = [row('Inbox'), row('Drafts'), row('Sent'), row('Spam')]

  it('goes to the next row starting with the letter, whatever its case', () => {
    expect(findTypeaheadMatch(rows, 0, 'd')).toBe(1)
    expect(findTypeaheadMatch(rows, 0, 'D')).toBe(1)
  })

  it('wraps around and cycles on the same letter', () => {
    expect(findTypeaheadMatch(rows, 2, 's')).toBe(3)
    expect(findTypeaheadMatch(rows, 3, 's')).toBe(2)
    expect(findTypeaheadMatch(rows, 3, 'ss')).toBe(2)
  })

  it('matches a longer prefix from the current row', () => {
    expect(findTypeaheadMatch(rows, 2, 'sp')).toBe(3)
    expect(findTypeaheadMatch(rows, 3, 'sp')).toBe(3)
  })

  it('finds nothing when no row matches', () => {
    expect(findTypeaheadMatch(rows, 0, 'z')).toBe(-1)
    expect(findTypeaheadMatch(rows, 0, '')).toBe(-1)
  })
})
