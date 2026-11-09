import {
  getHoverActionsRoom,
  getLeadWidth,
  getSkeletonTrailingWidth,
  getTrailingWidth,
  HOVER_DATE_GAP
} from './emailListGeometry'

describe('getLeadWidth', () => {
  it('holds the checkbox, the star and the two state slots in 32 px each with a mouse', () => {
    expect(getLeadWidth(false)).toBe(24 + 4 * 32)
  })

  it('holds a 44 px touch target for the star on a touch screen', () => {
    expect(getLeadWidth(true)).toBe(24 + 44 + 44 + 2 * 32)
  })
})

describe('getTrailingWidth', () => {
  it('keeps only the padding of the row with hover: the date and the actions run out of it', () => {
    expect(getTrailingWidth({ canHover: true, isTouch: false })).toBe(24)
  })

  it('holds the date beside five 44 px touch targets', () => {
    expect(getTrailingWidth({ canHover: false, isTouch: true })).toBe(
      16 + 5 * 44 + 24 + 116
    )
  })

  it('holds the date beside 32 px actions without hover nor touch', () => {
    expect(getTrailingWidth({ canHover: false, isTouch: false })).toBe(
      16 + 5 * 32 + 24 + 116
    )
  })
})

describe('getHoverActionsRoom', () => {
  it('holds the gap and the five actions', () => {
    expect(getHoverActionsRoom(false)).toBe(32 + 5 * 32)
    expect(getHoverActionsRoom(true)).toBe(32 + 5 * 44)
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
