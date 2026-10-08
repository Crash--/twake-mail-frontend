import { SCROLLBAR_CSS } from './scrollbarLook'

describe('SCROLLBAR_CSS', () => {
  it('draws a 6 px grey rounded thumb without track, while the pointer is over the area, as tmail-flutter', () => {
    expect(SCROLLBAR_CSS['*::-webkit-scrollbar']).toEqual({
      width: 6,
      height: 6
    })
    expect(SCROLLBAR_CSS['*::-webkit-scrollbar-thumb']).toEqual({
      backgroundColor: 'transparent',
      borderRadius: 10
    })
    expect(SCROLLBAR_CSS['*:hover::-webkit-scrollbar-thumb']).toEqual({
      backgroundColor: '#C1C1C1'
    })
    // No arrows, and Chromium is not given the standard properties, which
    // would replace this look by its own bar
    expect(SCROLLBAR_CSS['*::-webkit-scrollbar-button']).toEqual({
      display: 'none'
    })
    expect(SCROLLBAR_CSS['*']).toBeUndefined()
  })
})
