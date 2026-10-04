import { fitWindows } from './fitWindows'

describe('fitWindows', () => {
  it('keeps what fits, the newest first', () => {
    // 1200 - 32 = 1168: 600 + 8 + 280 + 8 + 280 = 1176 is too much
    expect(fitWindows(['normal', 'normal', 'normal'], 1200)).toEqual([
      'normal',
      'minimized',
      null
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
})
