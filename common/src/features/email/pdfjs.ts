import type { PDFDocumentProxy } from 'pdfjs-dist'

import { LOAD_TIMEOUT_MS, PDF_DOCUMENT_OPTIONS } from './pdfLimits'

export interface LoadedPdf {
  pdf: PDFDocumentProxy
}

export interface PdfLoad {
  promise: Promise<LoadedPdf>
  /** Stops the loading and terminates the worker, whatever the state */
  destroy: () => Promise<void>
}

/**
 * pdf.js, loaded when the first PDF is previewed. Its worker is a file of
 * the app (the CSP allows scripts from 'self' only). The options are in
 * `pdfLimits.ts`.
 */
export function loadPdf(data: Uint8Array): PdfLoad {
  let task: {
    promise: Promise<PDFDocumentProxy>
    destroy: () => Promise<void>
  } | null = null
  let isDestroyed = false
  const destroy = async (): Promise<void> => {
    isDestroyed = true
    await task?.destroy()
  }
  const open = async (): Promise<LoadedPdf> => {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
    task = pdfjs.getDocument({ ...PDF_DOCUMENT_OPTIONS, data })
    if (isDestroyed) {
      await task.destroy()
      throw new Error('PDF preview closed')
    }
    return { pdf: await task.promise }
  }
  const promise = new Promise<LoadedPdf>((resolve, reject) => {
    const timer = setTimeout(() => {
      void destroy()
      reject(new Error('PDF took too long to open'))
    }, LOAD_TIMEOUT_MS)
    open()
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(timer)
      })
  })
  return { promise, destroy }
}
