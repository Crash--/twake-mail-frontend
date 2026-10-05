import {
  MAX_CANVAS_PIXELS,
  MAX_CANVAS_SIDE,
  MAX_PIXEL_RATIO
} from './pdfLimits'

export interface PageLayout {
  /** Size of the canvas element in the page, CSS pixels */
  cssWidth: number
  cssHeight: number
  /** Size of its bitmap, bounded whatever the page claims to measure */
  canvasWidth: number
  canvasHeight: number
  /** pdf.js scale giving that bitmap */
  scale: number
}

/**
 * Fits a page of `pageWidth` x `pageHeight` (PDF units, as the document
 * declares them: hostile values included) in `cssWidth`, with a bitmap of at
 * most `MAX_CANVAS_PIXELS` and `MAX_CANVAS_SIDE`, drawn at the device pixel
 * ratio capped at `MAX_PIXEL_RATIO`. Null for a page without a usable size.
 */
export function fitPage(
  pageWidth: number,
  pageHeight: number,
  cssWidth: number,
  devicePixelRatio: number
): PageLayout | null {
  if (
    !(pageWidth > 0) ||
    !(pageHeight > 0) ||
    !(cssWidth > 0) ||
    !Number.isFinite(pageWidth) ||
    !Number.isFinite(pageHeight)
  ) {
    return null
  }
  const ratio = Math.min(Math.max(devicePixelRatio || 1, 1), MAX_PIXEL_RATIO)
  const cssHeight = (cssWidth * pageHeight) / pageWidth
  let width = cssWidth * ratio
  let height = cssHeight * ratio
  const shrink = Math.min(
    1,
    Math.sqrt(MAX_CANVAS_PIXELS / (width * height)),
    MAX_CANVAS_SIDE / Math.max(width, height)
  )
  width *= shrink
  height *= shrink
  const canvasWidth = Math.max(1, Math.floor(width))
  const canvasHeight = Math.max(1, Math.floor(height))
  return {
    cssWidth,
    cssHeight,
    canvasWidth,
    canvasHeight,
    scale: canvasWidth / pageWidth
  }
}
