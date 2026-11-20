import { lastRowInView, type RenderedRow } from './lastRowInView'

function rowsOf(count: number, size: number, first = 0): RenderedRow[] {
  return Array.from({ length: count }, (_, position) => ({
    index: first + position,
    offset: (first + position) * size,
    size
  }))
}

describe('lastRowInView', () => {
  it('leaves out the rows rendered in the overscan below the viewport', () => {
    // 16 rows of 49 px in view, 400 px of overscan: 24 rows rendered
    expect(lastRowInView(rowsOf(24, 49), 400)).toBe(15)
  })

  it('counts from the rows rendered once the list is scrolled', () => {
    expect(lastRowInView(rowsOf(26, 50, 40), 400)).toBe(57)
  })

  it('keeps the first rendered row when the overscan is taller than the rows', () => {
    expect(lastRowInView(rowsOf(3, 50), 400)).toBe(0)
  })

  it('is null when no row is rendered', () => {
    expect(lastRowInView([], 400)).toBe(null)
  })
})
