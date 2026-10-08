import { getLeadWidth, getTrailingWidth } from './emailListGeometry'

describe('getLeadWidth', () => {
  it('holds the checkbox, the star and the 32 px status indicator with a mouse', () => {
    expect(getLeadWidth(false)).toBe(8 + 32 + 2 * 32)
  })

  it('keeps the width of the checkbox and two 44 px touch targets on a touch screen', () => {
    expect(getLeadWidth(true)).toBe(8 + 32 + 2 * 44)
  })
})

describe('getTrailingWidth', () => {
  it('holds the five actions, which replace the date on hover', () => {
    expect(getTrailingWidth({ canHover: true, isTouch: false })).toBe(
      8 + 5 * 32 + 8
    )
  })

  it('holds the date beside five 44 px touch targets', () => {
    expect(getTrailingWidth({ canHover: false, isTouch: true })).toBe(
      8 + 5 * 44 + 8 + 124
    )
  })

  it('holds the date beside 32 px actions without hover nor touch', () => {
    expect(getTrailingWidth({ canHover: false, isTouch: false })).toBe(
      8 + 5 * 32 + 8 + 124
    )
  })
})
