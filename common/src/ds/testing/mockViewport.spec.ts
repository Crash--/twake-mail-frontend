import { matchesViewport } from './mockViewport'

describe('matchesViewport', () => {
  it('reads widths, pointers and hover', () => {
    const phone = { width: 390, touch: true }

    expect(matchesViewport('(max-width:599.95px)', phone)).toBe(true)
    expect(matchesViewport('@media (min-width:600px)', phone)).toBe(false)
    expect(matchesViewport('(pointer: coarse)', phone)).toBe(true)
    expect(matchesViewport('(hover: none)', phone)).toBe(true)
    expect(matchesViewport('(pointer: coarse)', { width: 1440 })).toBe(false)
  })

  it('combines conditions with and, lists with commas', () => {
    const tablet = { width: 820 }

    expect(
      matchesViewport('(min-width:600px) and (max-width:899.95px)', tablet)
    ).toBe(true)
    expect(
      matchesViewport('(min-width:900px) and (max-width:1199.95px)', tablet)
    ).toBe(false)
    expect(
      matchesViewport('(pointer: coarse), (max-width:899.95px)', tablet)
    ).toBe(true)
  })
})
