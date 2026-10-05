import type { PDFDocumentProxy } from 'pdfjs-dist'

export interface LoadedPdf {
  pdf: PDFDocumentProxy
  destroy: () => Promise<void>
}

/**
 * pdf.js, loaded when the first PDF is previewed. Its worker is a file of
 * the app (the CSP allows scripts from 'self' only).
 */
export async function loadPdf(data: Uint8Array): Promise<LoadedPdf> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
  const task = pdfjs.getDocument({
    data,
    // Nothing of the document runs or is fetched: no XFA forms, no
    // WebAssembly (the CSP has no 'wasm-unsafe-eval'; the JavaScript
    // decoders do the work), no system fonts, no streaming from a URL
    useWasm: false,
    enableXfa: false,
    disableFontFace: false,
    useSystemFonts: false,
    disableAutoFetch: true,
    disableStream: true
  })
  return { pdf: await task.promise, destroy: () => task.destroy() }
}

/** `AnnotationMode.DISABLE`: no link, form field nor script of the page */
export const ANNOTATIONS_DISABLED = 0
