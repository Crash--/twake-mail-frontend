import { fitPage } from './pdfLayout'
import { MAX_CANVAS_PIXELS, MAX_CANVAS_SIDE } from './pdfLimits'

describe('fitPage', () => {
  it('draws an A4 page at the pixel ratio, capped at 2', () => {
    const layout = fitPage(595, 842, 600, 3)
    expect(layout?.canvasWidth).toBe(1200)
    expect(layout?.cssWidth).toBe(600)
  })

  it('bounds the bitmap of a hostile, very tall page', () => {
    const layout = fitPage(200, 200_000, 900, 2)
    expect(layout).not.toBeNull()
    const { canvasWidth = 0, canvasHeight = 0 } = layout ?? {}
    expect(canvasWidth * canvasHeight).toBeLessThanOrEqual(MAX_CANVAS_PIXELS)
    expect(canvasHeight).toBeLessThanOrEqual(MAX_CANVAS_SIDE)
  })

  it('refuses a page without a usable size', () => {
    expect(fitPage(0, 100, 600, 1)).toBeNull()
    expect(fitPage(100, Number.NaN, 600, 1)).toBeNull()
    expect(fitPage(Number.POSITIVE_INFINITY, 100, 600, 1)).toBeNull()
  })
})
