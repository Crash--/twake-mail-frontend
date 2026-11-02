import {
  getHoverActionsRoom,
  getLeadWidth,
  getSkeletonTrailingWidth,
  getTrailingWidth,
  HOVER_DATE_GAP
} from './emailListGeometry'

describe('getLeadWidth', () => {
  it('holds the checkbox, the 20 px star and the two 28 px state slots of tmail-flutter with a mouse', () => {
    expect(getLeadWidth(false)).toBe(24 + 32 + 20 + 2 * 28)
  })

  it('holds a 44 px touch target for the star on a touch screen', () => {
    expect(getLeadWidth(true)).toBe(24 + 44 + 44 + 2 * 28)
  })
})

describe('getTrailingWidth', () => {
  it('keeps only the padding of the row with hover: the date and the actions run out of it', () => {
    expect(getTrailingWidth({ canHover: true, isTouch: false })).toBe(24)
  })

  it('holds the date beside five 44 px touch targets', () => {
    expect(getTrailingWidth({ canHover: false, isTouch: true })).toBe(
      16 + 5 * 44 + 4 * 11 + 24 + 112
    )
  })

  it('holds the date beside 26 px actions without hover nor touch', () => {
    expect(getTrailingWidth({ canHover: false, isTouch: false })).toBe(
      16 + 5 * 26 + 4 * 11 + 24 + 112
    )
  })
})

describe('getHoverActionsRoom', () => {
  it('holds the gap and the five actions 11 px apart', () => {
    expect(getHoverActionsRoom(false)).toBe(32 + 5 * 26 + 4 * 11)
    expect(getHoverActionsRoom(true)).toBe(32 + 5 * 44 + 4 * 11)
  })

  it('keeps 16 px between the preview and the date', () => {
    expect(HOVER_DATE_GAP).toBe(16)
  })
})

describe('getSkeletonTrailingWidth', () => {
  it('holds the bar of a date with hover, the real cell without', () => {
    expect(getSkeletonTrailingWidth({ canHover: true, isTouch: false })).toBe(
      24 + 16 + 56
    )
    expect(getSkeletonTrailingWidth({ canHover: false, isTouch: false })).toBe(
      getTrailingWidth({ canHover: false, isTouch: false })
    )
  })
})
