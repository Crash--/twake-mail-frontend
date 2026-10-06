import { dockedWindowWidth, fitWindows } from './fitWindows'

describe('fitWindows', () => {
  it('keeps what fits, the newest first, the rest in the overflow menu', () => {
    // 1700 - 48 = 1652 holds two windows (790 + 8 + 790) but not a third;
    // the menu of the one left out then takes 168 and the second shrinks
    expect(fitWindows(['normal', 'normal', 'normal'], 1700)).toEqual([
      'normal',
      'minimized',
      'overflow'
    ])
    expect(fitWindows(['normal', 'normal', 'normal'], 1900)).toEqual([
      'normal',
      'normal',
      'overflow'
    ])
    expect(fitWindows(['normal', 'normal', 'normal'], 2400)).toEqual([
      'normal',
      'normal',
      'minimized'
    ])
  })

  it('makes room for the overflow menu', () => {
    // 1500 - 48 = 1452 holds three title bars (400 + 2 x 408 = 1216), not
    // four; once the menu takes 160 + 8, three still fit, the fifth does not
    expect(
      fitWindows(
        ['minimized', 'minimized', 'minimized', 'minimized', 'minimized'],
        1500
      )
    ).toEqual(['minimized', 'minimized', 'minimized', 'overflow', 'overflow'])
    // 1200 - 48 = 1152 holds a window (790) but not a title bar more (408)
    expect(fitWindows(['normal', 'normal', 'normal'], 1200)).toEqual([
      'normal',
      'overflow',
      'overflow'
    ])
  })

  it('leaves minimized and full screen windows as they are', () => {
    expect(fitWindows(['fullscreen', 'minimized', 'normal'], 1400)).toEqual([
      'fullscreen',
      'minimized',
      'normal'
    ])
  })

  it('minimizes a window too wide for the screen', () => {
    expect(fitWindows(['fullscreen', 'minimized', 'normal'], 1200)).toEqual([
      'fullscreen',
      'minimized',
      'minimized'
    ])
    expect(fitWindows(['normal'], 500)).toEqual(['minimized'])
  })

  it('keeps the newest window in the dock however narrow the screen', () => {
    expect(fitWindows(['normal', 'normal'], 360)).toEqual([
      'minimized',
      'overflow'
    ])
  })
})

describe('dockedWindowWidth', () => {
  it('is 790 px where the screen has room, less on a tablet', () => {
    expect(dockedWindowWidth(1440)).toBe(790)
    expect(dockedWindowWidth(820)).toBe(772)
    expect(dockedWindowWidth(600)).toBe(552)
  })

  it('keeps 790 px below the narrowest tablet, where the window is minimized', () => {
    expect(dockedWindowWidth(500)).toBe(790)
  })

  it('shows a normal window on a tablet screen', () => {
    expect(fitWindows(['normal'], 820)).toEqual(['normal'])
    expect(fitWindows(['normal'], 600)).toEqual(['normal'])
  })
})
