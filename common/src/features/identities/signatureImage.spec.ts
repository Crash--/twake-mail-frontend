import {
  prepareSignatureImage,
  rasterizeSvg,
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

interface FakeContext {
  fillRect: jest.Mock
  drawImage: jest.Mock
  toBlob: jest.Mock
}

/** The canvas encodes an image of `size` bytes, or nothing */
function encodesAs(size: number | null): FakeContext {
  const toBlob = jest.fn((resolve: (blob: Blob | null) => void) => {
    resolve(size === null ? null : new Blob([new Uint8Array(size)]))
  })
  const context = {
    fillStyle: '',
    fillRect: jest.fn(),
    drawImage: jest.fn(),
    toBlob
  }
  const canvas = { width: 0, height: 0, getContext: () => context, toBlob }
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => canvas }
  })
  return context
}

const svgFile = (name = 'logo.svg'): File =>
  new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], name, {
    type: 'image/svg+xml'
  })

/** The browser loads an image of that natural size, or fails to (null) */
function loadsAs(size: { width: number; height: number } | null): void {
  class FakeImage {
    naturalWidth = size?.width ?? 0
    naturalHeight = size?.height ?? 0
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_url: string) {
      queueMicrotask(() => {
        if (size === null) this.onerror?.()
        else this.onload?.()
      })
    }
  }
  Object.defineProperty(globalThis, 'Image', {
    configurable: true,
    value: FakeImage
  })
}

describe('signatureImage', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'createImageBitmap')
    Reflect.deleteProperty(globalThis, 'document')
    Reflect.deleteProperty(globalThis, 'Image')
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

  it('draws an SVG into a transparent PNG at most at the signature width', async () => {
    loadsAs({ width: 1600, height: 400 })
    const context = encodesAs(5000)

    const png = await rasterizeSvg(svgFile(), 800)

    expect(context.fillRect).not.toHaveBeenCalled()
    expect(context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      800,
      200
    )
    expect(context.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/png',
      expect.anything()
    )
    expect(png?.name).toBe('logo.png')
    expect(png?.type).toBe('image/png')
    expect(png?.size).toBe(5000)
  })

  it('draws an SVG without a size of its own at 300 by 150 px', async () => {
    loadsAs({ width: 0, height: 0 })
    const context = encodesAs(5000)

    await rasterizeSvg(svgFile(), 800)

    expect(context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      300,
      150
    )
  })

  it('gives no PNG for an SVG the browser cannot read or draw', async () => {
    loadsAs(null)
    encodesAs(5000)
    expect(await rasterizeSvg(svgFile(), 800)).toBe(null)

    loadsAs({ width: 100, height: 100 })
    encodesAs(null)
    expect(await rasterizeSvg(svgFile(), 800)).toBe(null)
  })
})
