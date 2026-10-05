import {
  MAX_CANVAS_PIXELS,
  MAX_IMAGE_PIXELS,
  PDF_DOCUMENT_OPTIONS
} from './pdfLimits'

describe('PDF_DOCUMENT_OPTIONS', () => {
  it('turns off everything an untrusted document could use', () => {
    expect(PDF_DOCUMENT_OPTIONS).toMatchObject({
      disableFontFace: true,
      useSystemFonts: false,
      useWasm: false,
      enableXfa: false,
      disableRange: true,
      disableAutoFetch: true,
      disableStream: true,
      verbosity: 0
    })
  })

  it('bounds the images and canvases', () => {
    expect(PDF_DOCUMENT_OPTIONS.maxImageSize).toBe(MAX_IMAGE_PIXELS)
    expect(PDF_DOCUMENT_OPTIONS.canvasMaxAreaInBytes).toBe(
      MAX_CANVAS_PIXELS * 4
    )
  })

  it('points to no remote resource', () => {
    const keys = Object.keys(PDF_DOCUMENT_OPTIONS)
    for (const key of [
      'cMapUrl',
      'standardFontDataUrl',
      'iccUrl',
      'wasmUrl',
      'isEvalSupported'
    ]) {
      expect(keys).not.toContain(key)
    }
  })
})
