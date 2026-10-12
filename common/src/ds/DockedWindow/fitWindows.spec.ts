import { dockedWindowWidth, fitWindows } from './fitWindows'

describe('fitWindows', () => {
  it('keeps what fits, the newest first, the rest minimized or in the overflow menu', () => {
    // 1700 - 40 = 1660 holds two shared windows (600 + 8 + 600) and a
    // title bar (8 + 400), not a third window
    expect(fitWindows(['normal', 'normal', 'normal'], 1700)).toEqual([
      'normal',
      'normal',
      'minimized'
    ])
    expect(fitWindows(['normal', 'normal', 'normal'], 1900)).toEqual([
      'normal',
      'normal',
      'normal'
    ])
  })

  it('makes room for the overflow menu', () => {
    // 1500 - 40 = 1460 holds three title bars (400 + 2 x 408 = 1216), not
    // four; once the menu takes 160 + 8, three still fit, the fifth does not
    expect(
      fitWindows(
        ['minimized', 'minimized', 'minimized', 'minimized', 'minimized'],
        1500
      )
    ).toEqual(['minimized', 'minimized', 'minimized', 'overflow', 'overflow'])
    // 1200 - 40 = 1160 holds a window (600) and a title bar, not two more;
    // once the menu takes its room, the window alone
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
  it('is 55 % of a desktop screen for a window alone, as tmail-flutter', () => {
    expect(dockedWindowWidth(1440)).toBe(792)
    expect(dockedWindowWidth(1920)).toBe(1056)
  })

  it('is 600 px for each of several windows, as tmail-flutter', () => {
    expect(dockedWindowWidth(1440, 2)).toBe(600)
  })

  it('is 790 px on a tablet, less where the screen has no room for it', () => {
    expect(dockedWindowWidth(820)).toBe(780)
    expect(dockedWindowWidth(600)).toBe(560)
  })

  it('keeps 790 px below the narrowest tablet, where the window is minimized', () => {
    expect(dockedWindowWidth(500)).toBe(790)
  })

  it('shows a normal window on a tablet screen', () => {
    expect(fitWindows(['normal'], 820)).toEqual(['normal'])
    expect(fitWindows(['normal'], 600)).toEqual(['normal'])
  })
})
