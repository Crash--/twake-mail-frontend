import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { useEffect, useRef, type ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

import { fitPage } from './pdfLayout'
import { ANNOTATIONS_DISABLED, RENDER_TIMEOUT_MS } from './pdfLimits'

export interface PdfPageProps {
  pdf: PDFDocumentProxy
  /** 1-based */
  number: number
  /** Width of the page in the dialog, CSS pixels */
  cssWidth: number
  /** Height before the page is drawn: the one of the first page */
  estimatedHeight: number
  onError: () => void
}

/**
 * One page of a PDF, drawn when it scrolls into view and released when it
 * leaves it: a document of thousands of pages never holds more than a few
 * bitmaps. A page that takes too long is cancelled.
 */
export function PdfPage({
  pdf,
  number,
  cssWidth,
  estimatedHeight,
  onError
}: PdfPageProps): ReactElement {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${estimatedHeight}px`
    let task: RenderTask | null = null
    const state = {
      isVisible: false,
      isCancelled: false,
      isDrawn: false,
      isBusy: false,
      isFailed: false
    }

    const isStale = (): boolean => state.isCancelled || !state.isVisible

    const release = (): void => {
      task?.cancel()
      task = null
      if (!state.isDrawn) return
      state.isDrawn = false
      canvas.width = 1
      canvas.height = 1
      canvas.style.height = `${estimatedHeight}px`
      delete canvas.dataset.rendered
    }

    const draw = async (): Promise<void> => {
      const page = await pdf.getPage(number)
      if (isStale()) return
      const base = page.getViewport({ scale: 1 })
      const layout = fitPage(
        base.width,
        base.height,
        cssWidth,
        window.devicePixelRatio
      )
      if (layout === null) throw new Error('PDF page without a size')
      const context = canvas.getContext('2d')
      if (!context) throw new Error('No 2D canvas context')
      canvas.width = layout.canvasWidth
      canvas.height = layout.canvasHeight
      canvas.style.width = `${layout.cssWidth}px`
      canvas.style.height = `${layout.cssHeight}px`
      const current = page.render({
        canvas,
        canvasContext: context,
        viewport: page.getViewport({ scale: layout.scale }),
        annotationMode: ANNOTATIONS_DISABLED
      })
      task = current
      const timeout = { isFired: false }
      const timer = setTimeout(() => {
        timeout.isFired = true
        current.cancel()
      }, RENDER_TIMEOUT_MS)
      try {
        await current.promise
        state.isDrawn = true
        canvas.dataset.rendered = 'true'
      } catch (error: unknown) {
        // Cancelled by a scroll or the unmount: not an error
        if (timeout.isFired) {
          throw new Error('PDF page took too long to draw', { cause: error })
        }
        if (isStale()) return
        throw error
      } finally {
        clearTimeout(timer)
      }
    }

    const start = (): void => {
      if (
        state.isCancelled ||
        !state.isVisible ||
        state.isDrawn ||
        state.isBusy ||
        state.isFailed
      )
        return
      state.isBusy = true
      draw()
        .catch((error: unknown) => {
          if (state.isCancelled) return
          state.isFailed = true
          console.error('[email] PDF preview failed', error)
          onErrorRef.current()
        })
        .finally(() => {
          task = null
          state.isBusy = false
          // Scrolled back while the previous attempt was being cancelled
          start()
        })
    }

    // The window the node is rendered in, maybe not this one (the overlay of
    // TwakeSpace): an observer only follows the documents of its own window
    const view = canvas.ownerDocument.defaultView ?? window
    const observer = new view.IntersectionObserver(entries => {
      for (const entry of entries) {
        state.isVisible = entry.isIntersecting
        if (state.isVisible) start()
        else release()
      }
    })
    observer.observe(canvas)
    return () => {
      state.isCancelled = true
      observer.disconnect()
      task?.cancel()
    }
  }, [pdf, number, cssWidth, estimatedHeight])

  return (
    <canvas
      ref={canvasRef}
      data-page={number}
      role="img"
      aria-label={t('email.preview.page', {
        page: number,
        count: pdf.numPages
      })}
      className="u-db u-mb-1"
    />
  )
}
