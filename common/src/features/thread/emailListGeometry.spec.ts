import { getLeadWidth, getTrailingWidth } from './emailListGeometry'

describe('getLeadWidth', () => {
  it('holds the checkbox, the 20 px star and the two 28 px state slots of tmail-flutter with a mouse', () => {
    expect(getLeadWidth(false)).toBe(3 + 44 + 20 + 2 * 28)
  })

  it('holds a 44 px touch target for the star on a touch screen', () => {
    expect(getLeadWidth(true)).toBe(3 + 44 + 44 + 2 * 28)
  })
})

describe('getTrailingWidth', () => {
  it('holds the five actions, which replace the date on hover', () => {
    expect(getTrailingWidth({ canHover: true, isTouch: false })).toBe(
      16 + 5 * 32 + 16 + 3
    )
  })

  it('holds the date beside five 44 px touch targets', () => {
    expect(getTrailingWidth({ canHover: false, isTouch: true })).toBe(
      16 + 5 * 44 + 16 + 3 + 132
    )
  })

  it('holds the date beside 32 px actions without hover nor touch', () => {
    expect(getTrailingWidth({ canHover: false, isTouch: false })).toBe(
      16 + 5 * 32 + 16 + 3 + 132
    )
  })
})
