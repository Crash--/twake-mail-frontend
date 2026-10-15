import {
  prepareSignatureImage,
  scaledImageSize,
  SIGNATURE_IMAGE_BUDGET,
  signatureImageMaxWidth
} from './signatureImage'

const imageFile = (size: number, name = 'logo.png'): File =>
  new File([new Uint8Array(size)], name, { type: 'image/png' })

/** The browser decodes a `width` × `height` image */
function decodesAs(width: number, height: number): void {
  Object.defineProperty(globalThis, 'createImageBitmap', {
    configurable: true,
    value: jest.fn(() => Promise.resolve({ width, height, close: jest.fn() }))
  })
}

/** The canvas encodes a JPEG of `size` bytes, or nothing */
function encodesAs(size: number | null): { drawImage: jest.Mock } {
  const context = { fillStyle: '', fillRect: jest.fn(), drawImage: jest.fn() }
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toBlob: (resolve: (blob: Blob | null) => void) => {
      resolve(size === null ? null : new Blob([new Uint8Array(size)]))
    }
  }
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => canvas }
  })
  return context
}

describe('signatureImage', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'createImageBitmap')
    Reflect.deleteProperty(globalThis, 'document')
  })

  it('lets a signature image be 800 px wide on a desktop and 700 px elsewhere', () => {
    expect(signatureImageMaxWidth(true)).toBe(800)
    expect(signatureImageMaxWidth(false)).toBe(700)
  })

  it('scales an image down to the width, keeping its ratio, never up', () => {
    expect(scaledImageSize(1600, 900, 800)).toEqual({ width: 800, height: 450 })
    expect(scaledImageSize(400, 300, 800)).toEqual({ width: 400, height: 300 })
  })

  it('keeps a light image and shows it at most at the signature width', async () => {
    decodesAs(1600, 900)
    const file = imageFile(SIGNATURE_IMAGE_BUDGET)

    expect(await prepareSignatureImage(file, 800, Infinity)).toEqual({
      file,
      width: 800
    })
  })

  it('keeps the width of a narrow light image', async () => {
    decodesAs(200, 50)
    const file = imageFile(1000)

    expect(await prepareSignatureImage(file, 800, Infinity)).toEqual({
      file,
      width: 200
    })
  })

  it('re-encodes a heavy image as a JPEG at the signature width', async () => {
    decodesAs(1600, 900)
    const context = encodesAs(20_000)

    const image = await prepareSignatureImage(
      imageFile(SIGNATURE_IMAGE_BUDGET + 1, 'photo.png'),
      800,
      Infinity
    )

    expect(context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      800,
      450
    )
    expect(image?.width).toBe(800)
    expect(image?.file.name).toBe('photo.jpg')
    expect(image?.file.type).toBe('image/jpeg')
    expect(image?.file.size).toBe(20_000)
  })

  it('re-encodes a heavy narrow image without enlarging it', async () => {
    decodesAs(300, 100)
    const context = encodesAs(20_000)

    const image = await prepareSignatureImage(
      imageFile(SIGNATURE_IMAGE_BUDGET * 2),
      800,
      Infinity
    )

    expect(context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      300,
      100
    )
    expect(image?.width).toBe(300)
    expect(image?.file.size).toBe(20_000)
  })

  it('keeps a heavy image the server takes when it cannot be re-encoded', async () => {
    decodesAs(1600, 900)
    encodesAs(null)
    const file = imageFile(SIGNATURE_IMAGE_BUDGET * 2)

    expect(await prepareSignatureImage(file, 800, file.size)).toEqual({
      file,
      width: 800
    })
    expect(await prepareSignatureImage(file, 800, file.size - 1)).toBe(null)
  })

  it('keeps an unreadable image the server takes, at its own width', async () => {
    const file = imageFile(SIGNATURE_IMAGE_BUDGET * 2)

    expect(await prepareSignatureImage(file, 800, file.size)).toEqual({
      file,
      width: null
    })
    expect(await prepareSignatureImage(file, 800, file.size - 1)).toBe(null)
  })
})
