import { TEXT_LOOK_CSS } from './textLook'

describe('TEXT_LOOK_CSS', () => {
  it('draws the text unhinted, without optical sizing, form controls included', () => {
    expect(TEXT_LOOK_CSS).toEqual({
      'html, button, input, textarea, select': {
        textRendering: 'geometricPrecision',
        fontOpticalSizing: 'none'
      }
    })
  })
})
