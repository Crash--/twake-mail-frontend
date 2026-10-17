import type { PDFDocumentProxy } from 'pdfjs-dist'

import { fitPage } from './pdfLayout'
import { ANNOTATIONS_DISABLED, PRINT_SCALE } from './pdfLimits'
import { escapeHtml, printHtmlDocument } from './printDocument'

export interface PdfPrintPage {
  /** Object URL of the page drawn as a PNG */
  url: string
  /** "Page 1 of 3" */
  label: string
}

export interface PdfPrintOptions {
  lang: string
  /** Title of the printed document: the file name */
  title: string
  pageLabel: (page: number, count: number) => string
  /** Aborted when the preview closes: nothing is printed */
  signal: AbortSignal
}

const PDF_PRINT_CSS = `
@page { margin: 0; }
html, body { margin: 0; padding: 0; }
img { display: block; max-width: 100%; max-height: 100vh; margin: 0 auto; break-inside: avoid; break-after: page; }
img:last-child { break-after: auto; }
`

/** The HTML document printing the pages, one per sheet; nothing runs */
export function buildPdfPrintDocument(
  lang: string,
  title: string,
  pages: readonly PdfPrintPage[]
): string {
  const policy = [
    "default-src 'none'",
    'img-src blob:',
    "style-src 'unsafe-inline'"
  ].join('; ')
  const images = pages
    .map(
      page =>
        `<img src="${escapeHtml(page.url)}" alt="${escapeHtml(page.label)}">`
    )
    .join('')
  return [
    `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8">`,
    `<meta http-equiv="Content-Security-Policy" content="${policy}">`,
    '<meta name="referrer" content="no-referrer">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${PDF_PRINT_CSS}</style></head><body>`,
    images,
    '</body></html>'
  ].join('')
}

async function drawPage(pdf: PDFDocumentProxy, number: number): Promise<Blob> {
  const page = await pdf.getPage(number)
  const base = page.getViewport({ scale: 1 })
  const layout = fitPage(base.width, base.height, base.width * PRINT_SCALE, 1)
  if (layout === null) throw new Error('PDF page without a size')
  const canvas = document.createElement('canvas')
  try {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No 2D canvas context')
    canvas.width = layout.canvasWidth
    canvas.height = layout.canvasHeight
    await page.render({
      canvas,
      canvasContext: context,
      viewport: page.getViewport({ scale: layout.scale }),
      annotationMode: ANNOTATIONS_DISABLED
    }).promise
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('PDF page not turned into an image'))
      }, 'image/png')
    })
  } finally {
    // Releases the bitmap now rather than when collected
    canvas.width = 0
    canvas.height = 0
  }
}

/**
 * Prints an open PDF (tf#2708, tf#2764, tf#3225): the browser cannot print
 * the file itself (no PDF plugin under the CSP), so each page is drawn by
 * pdf.js, one after the other, as an image of a print frame
 * (`printHtmlDocument`). The images are released once the frame is gone.
 */
export async function printPdf(
  pdf: PDFDocumentProxy,
  { lang, title, pageLabel, signal }: PdfPrintOptions
): Promise<void> {
  const urls: string[] = []
  const revoke = (): void => {
    urls.forEach(url => {
      URL.revokeObjectURL(url)
    })
  }
  try {
    const pages: PdfPrintPage[] = []
    for (let number = 1; number <= pdf.numPages; number += 1) {
      signal.throwIfAborted()
      const url = URL.createObjectURL(await drawPage(pdf, number))
      urls.push(url)
      pages.push({ url, label: pageLabel(number, pdf.numPages) })
    }
    signal.throwIfAborted()
    await printHtmlDocument(buildPdfPrintDocument(lang, title, pages), revoke)
  } catch (error: unknown) {
    revoke()
    throw error
  }
}
