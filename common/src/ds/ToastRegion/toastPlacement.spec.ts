import { isSamePlacement, placeToast } from './toastPlacement'

const SCREEN = { width: 1280, height: 720 }

describe('placeToast', () => {
  it('stays at the bottom centre without a docked window', () => {
    expect(placeToast([], SCREEN)).toEqual({ kind: 'center' })
  })

  it('goes 16 px left of a docked window when there is room', () => {
    expect(placeToast([{ left: 630, top: 118, right: 1260 }], SCREEN)).toEqual({
      kind: 'beside',
      right: 1280 - 630 + 16,
      maxWidth: 424,
      bottom: null
    })
  })

  it('narrows to the room left of the windows', () => {
    expect(placeToast([{ left: 350, top: 118, right: 1260 }], SCREEN)).toEqual({
      kind: 'beside',
      right: 1280 - 350 + 16,
      maxWidth: 350 - 32,
      bottom: null
    })
  })

  it('goes left of an open window, above the minimized one it would cover', () => {
    expect(
      placeToast(
        [
          { left: 634, top: 118, right: 1264 },
          { left: 226, top: 656, right: 626 }
        ],
        SCREEN
      )
    ).toEqual({
      kind: 'beside',
      right: 1280 - 634 + 16,
      maxWidth: 424,
      bottom: 720 - 656 + 16
    })
  })

  it('goes right above a minimized window on the right of an open one', () => {
    expect(
      placeToast(
        [
          { left: 214, top: 118, right: 844 },
          { left: 852, top: 656, right: 1260 }
        ],
        SCREEN
      )
    ).toEqual({
      kind: 'beside',
      right: 1280 - 1260,
      maxWidth: 1260 - 852,
      bottom: 720 - 656 + 16
    })
  })

  it('goes left of minimized windows only, at its usual height', () => {
    expect(placeToast([{ left: 860, top: 656, right: 1260 }], SCREEN)).toEqual({
      kind: 'beside',
      right: 1280 - 860 + 16,
      maxWidth: 424,
      bottom: null
    })
  })

  it('goes above them all when no window leaves room beside or above it', () => {
    expect(
      placeToast(
        [
          { left: 20, top: 100, right: 290 },
          { left: 298, top: 66, right: 560 }
        ],
        { width: 600, height: 720 }
      )
    ).toEqual({
      kind: 'above',
      bottom: 720 - 66 + 16,
      centerX: (20 + 560) / 2
    })
  })
})

describe('placeToast, with bars (the answers of the reader)', () => {
  it('goes 16 px above a bar under its usual place, still centred', () => {
    expect(
      placeToast([], SCREEN, [{ left: 0, top: 664, right: 1280 }])
    ).toEqual({ kind: 'above', bottom: 720 - 664 + 16, centerX: 640 })
  })

  it('goes above a bar under part of its usual place', () => {
    expect(
      placeToast([], SCREEN, [{ left: 700, top: 664, right: 1280 }])
    ).toEqual({ kind: 'above', bottom: 720 - 664 + 16, centerX: 640 })
  })

  it('stays at its usual place over no bar', () => {
    expect(
      placeToast([], SCREEN, [{ left: 900, top: 664, right: 1280 }])
    ).toEqual({ kind: 'center' })
  })

  it('goes left of a docked window, above the bar under it there', () => {
    expect(
      placeToast([{ left: 630, top: 118, right: 1260 }], SCREEN, [
        { left: 236, top: 664, right: 1280 }
      ])
    ).toEqual({
      kind: 'beside',
      right: 1280 - 630 + 16,
      maxWidth: 424,
      bottom: 720 - 664 + 16
    })
  })

  it('stays left of a docked window at its usual height over no bar', () => {
    expect(
      placeToast([{ left: 630, top: 118, right: 1260 }], SCREEN, [
        { left: 700, top: 664, right: 1280 }
      ])
    ).toEqual({
      kind: 'beside',
      right: 1280 - 630 + 16,
      maxWidth: 424,
      bottom: null
    })
  })

  it('goes left of a minimized window, above the bar under it there', () => {
    expect(
      placeToast([{ left: 860, top: 600, right: 1260 }], SCREEN, [
        { left: 236, top: 664, right: 1280 }
      ])
    ).toEqual({
      kind: 'beside',
      right: 1280 - 860 + 16,
      maxWidth: 424,
      bottom: 720 - 664 + 16
    })
  })
})

describe('isSamePlacement', () => {
  it('tells equal placements from different ones', () => {
    expect(isSamePlacement({ kind: 'center' }, { kind: 'center' })).toBe(true)
    expect(
      isSamePlacement(
        { kind: 'center' },
        { kind: 'beside', right: 1, maxWidth: 300, bottom: null }
      )
    ).toBe(false)
  })
})
