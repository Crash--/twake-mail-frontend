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
 * Asked when the document is encrypted (`isRetry`: the last password was
 * wrong): the password, or `null` to give up
 */
export type PdfPasswordRequest = (isRetry: boolean) => Promise<string | null>

/**
 * pdf.js, loaded when the first PDF is previewed. Its worker is a file of
 * the app (the CSP allows scripts from 'self' only). The options are in
 * `pdfLimits.ts`. The time given to open the document does not run while
 * the password is asked.
 */
export function loadPdf(
  data: Uint8Array,
  requestPassword: PdfPasswordRequest
): PdfLoad {
  let task: {
    promise: Promise<PDFDocumentProxy>
    destroy: () => Promise<void>
  } | null = null
  let isDestroyed = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const stopTimer = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const destroy = async (): Promise<void> => {
    isDestroyed = true
    stopTimer()
    await task?.destroy()
  }
  let rejectLoad: (reason: Error) => void = () => undefined
  const startTimer = (): void => {
    stopTimer()
    timer = setTimeout(() => {
      void destroy()
      rejectLoad(new Error('PDF took too long to open'))
    }, LOAD_TIMEOUT_MS)
  }
  const askPassword = async (isRetry: boolean): Promise<string | null> => {
    stopTimer()
    try {
      return await requestPassword(isRetry)
    } finally {
      if (!isDestroyed) startTimer()
    }
  }
  const open = async (): Promise<LoadedPdf> => {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
    const loadingTask = pdfjs.getDocument({ ...PDF_DOCUMENT_OPTIONS, data })
    loadingTask.onPassword = (
      updatePassword: (password: string | Error) => void,
      reason: number
    ): void => {
      const answer = (password: string | Error): void => {
        // pdf.js has already given up on a destroyed document
        if (!isDestroyed) updatePassword(password)
      }
      askPassword(reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD)
        .then(password => {
          answer(password ?? new Error('PDF password not given'))
        })
        .catch((error: unknown) => {
          answer(
            error instanceof Error ? error : new Error('PDF password not given')
          )
        })
    }
    task = loadingTask
    if (isDestroyed) {
      await task.destroy()
      throw new Error('PDF preview closed')
    }
    return { pdf: await task.promise }
  }
  const promise = new Promise<LoadedPdf>((resolve, reject) => {
    rejectLoad = reject
    startTimer()
    open().then(resolve, reject).finally(stopTimer)
  })
  return { promise, destroy }
}
