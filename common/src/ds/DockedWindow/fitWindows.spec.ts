import { fitWindows } from './fitWindows'

describe('fitWindows', () => {
  it('keeps what fits, the newest first, the rest in the overflow menu', () => {
    // 1200 - 32 = 1168: 600 + 8 + 280 + 8 + 280 = 1176 is too much
    expect(fitWindows(['normal', 'normal', 'normal'], 1200)).toEqual([
      'normal',
      'minimized',
      'overflow'
    ])
    expect(fitWindows(['normal', 'normal', 'normal'], 1600)).toEqual([
      'normal',
      'normal',
      'minimized'
    ])
    expect(fitWindows(['normal', 'normal', 'normal'], 1920)).toEqual([
      'normal',
      'normal',
      'normal'
    ])
  })

  it('makes room for the overflow menu', () => {
    // 1000 - 32 = 968 holds three title bars (280 + 2 × 288 = 856), not
    // four; once the menu takes 160 + 8, two only
    expect(
      fitWindows(['minimized', 'minimized', 'minimized', 'minimized'], 1000)
    ).toEqual(['minimized', 'minimized', 'overflow', 'overflow'])
    // 900 - 32 = 868 holds a window (600) but not a title bar more (288);
    // with the menu, the window still fits
    expect(fitWindows(['normal', 'normal', 'normal'], 900)).toEqual([
      'normal',
      'overflow',
      'overflow'
    ])
  })

  it('leaves minimized and full screen windows as they are', () => {
    expect(fitWindows(['fullscreen', 'minimized', 'normal'], 1200)).toEqual([
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
