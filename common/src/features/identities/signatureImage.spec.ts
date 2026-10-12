import {
  scaledImageSize,
  shrinkSignatureImage,
  signatureImageMaxWidth
} from './signatureImage'

describe('signatureImage', () => {
  it('lets a shrunk image be 40 % of the screen, at least 800 px on a desktop and 700 px elsewhere', () => {
    expect(signatureImageMaxWidth(1440, true)).toBe(800)
    expect(signatureImageMaxWidth(2560, true)).toBe(1024)
    expect(signatureImageMaxWidth(390, false)).toBe(700)
  })

  it('scales an image down to the width, keeping its ratio, never up', () => {
    expect(scaledImageSize(1600, 900, 800)).toEqual({ width: 800, height: 450 })
    expect(scaledImageSize(400, 300, 800)).toEqual({ width: 400, height: 300 })
  })

  it('keeps an image the server takes as it is', async () => {
    const file = new File(['logo'], 'logo.png', { type: 'image/png' })

    expect(await shrinkSignatureImage(file, 1000, 800)).toBe(file)
  })
})
