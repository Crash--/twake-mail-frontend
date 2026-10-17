import { PDF_LINK_PROTOCOLS } from './pdfLimits'

/** A link of a page, placed in fractions of the page (0 to 1) */
export interface PdfLink {
  url: string
  left: number
  top: number
  width: number
  height: number
}

/** What the links need of a pdf.js `PageViewport` */
export interface PdfLinkViewport {
  width: number
  height: number
  convertToViewportPoint: (x: number, y: number) => number[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toSafeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return PDF_LINK_PROTOCOLS.has(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function isRect(value: unknown): value is [number, number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(item => typeof item === 'number' && Number.isFinite(item))
  )
}

const clamp = (value: number): number => Math.min(Math.max(value, 0), 1)

function toLink(
  annotation: unknown,
  viewport: PdfLinkViewport
): PdfLink | null {
  if (!isRecord(annotation) || annotation.subtype !== 'Link') return null
  const url = toSafeUrl(annotation.url)
  if (url === null || !isRect(annotation.rect)) return null
  const [pdfX1, pdfY1, pdfX2, pdfY2] = annotation.rect
  const [x1 = 0, y1 = 0] = viewport.convertToViewportPoint(pdfX1, pdfY1)
  const [x2 = 0, y2 = 0] = viewport.convertToViewportPoint(pdfX2, pdfY2)
  const left = clamp(Math.min(x1, x2) / viewport.width)
  const top = clamp(Math.min(y1, y2) / viewport.height)
  const width = clamp(Math.max(x1, x2) / viewport.width) - left
  const height = clamp(Math.max(y1, y2) / viewport.height) - top
  if (!(width > 0) || !(height > 0)) return null
  return { url, left, top, width, height }
}

/**
 * The links of a page (`page.getAnnotations()`, as the document declares
 * them: hostile values included) that the preview draws: a URL of
 * `PDF_LINK_PROTOCOLS` over a rectangle of the page. Links to another place
 * of the document, scripts and the other annotations are left out.
 */
export function findPdfLinks(
  annotations: readonly unknown[],
  viewport: PdfLinkViewport
): PdfLink[] {
  if (!(viewport.width > 0) || !(viewport.height > 0)) return []
  return annotations.flatMap(annotation => {
    const link = toLink(annotation, viewport)
    return link === null ? [] : [link]
  })
}
