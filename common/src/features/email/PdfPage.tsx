import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement
} from 'react'

import {
  PdfLinkArea,
  PdfPageFrame,
  PdfTextLayer
} from '@/ds/PdfPageLayers/PdfPageLayers'
import { useI18n } from '@common/i18n/useI18n'

import { fitPage } from './pdfLayout'
import { ANNOTATIONS_DISABLED, RENDER_TIMEOUT_MS } from './pdfLimits'
import { findPdfLinks, type PdfLink } from './pdfLinks'
import { renderTextLayer, type TextLayerTask } from './pdfjs'

export interface PdfPageProps {
  pdf: PDFDocumentProxy
  /** 1-based */
  number: number
  /** Width of the page in the dialog, CSS pixels */
  cssWidth: number
  /** Height before the page is drawn: the one of the first page */
  estimatedHeight: number
  onError: () => void
  /** A mailto: link of the page was followed */
  onMailtoLink: (href: string) => void
}

/**
 * One page of a PDF, drawn when it scrolls into view and released when it
 * leaves it: a document of thousands of pages never holds more than a few
 * bitmaps. A page that takes too long is cancelled. Once drawn, its text is
 * laid over it (selectable, and read by a screen reader) and so are its web
 * and mailto: links; a page whose text cannot be read stays an image.
 */
export function PdfPage({
  pdf,
  number,
  cssWidth,
  estimatedHeight,
  onError,
  onMailtoLink
}: PdfPageProps): ReactElement {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const onErrorRef = useRef(onError)
  const [links, setLinks] = useState<readonly PdfLink[]>([])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    const canvas = canvasRef.current
    const textLayer = textLayerRef.current
    if (!canvas || !textLayer) return
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${estimatedHeight}px`
    let task: RenderTask | null = null
    let textTask: TextLayerTask | null = null
    const state = {
      isVisible: false,
      isCancelled: false,
      isDrawn: false,
      isBusy: false,
      isFailed: false
    }

    const isStale = (): boolean => state.isCancelled || !state.isVisible

    const clearLayers = (): void => {
      textTask?.cancel()
      textTask = null
      textLayer.replaceChildren()
    }

    const release = (): void => {
      task?.cancel()
      task = null
      clearLayers()
      setLinks([])
      if (!state.isDrawn) return
      state.isDrawn = false
      canvas.width = 1
      canvas.height = 1
      canvas.style.height = `${estimatedHeight}px`
      delete canvas.dataset.rendered
    }

    // Not an error of the preview: the page stays readable as an image
    const showLayers = (page: PDFPageProxy, scale: number): void => {
      const base = page.getViewport({ scale: 1 })
      textLayer.style.setProperty('--total-scale-factor', String(scale))
      const current = renderTextLayer(
        page,
        page.getViewport({ scale }),
        textLayer
      )
      textTask = current
      current.promise.catch((error: unknown) => {
        if (isStale() || textTask !== current) return
        console.warn('[email] PDF text not laid out', error)
      })
      page
        .getAnnotations({ intent: 'display' })
        .then(annotations => {
          if (!isStale()) setLinks(findPdfLinks(annotations, base))
        })
        .catch((error: unknown) => {
          console.warn('[email] PDF links not read', error)
        })
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
      if (isStale()) return
      showLayers(page, layout.cssWidth / base.width)
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
      clearLayers()
    }
  }, [pdf, number, cssWidth, estimatedHeight])

  const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    const { href } = event.currentTarget
    if (!href.startsWith('mailto:')) return
    event.preventDefault()
    onMailtoLink(href)
  }

  return (
    <PdfPageFrame>
      <canvas
        ref={canvasRef}
        data-page={number}
        role="img"
        aria-label={t('email.preview.page', {
          page: number,
          count: pdf.numPages
        })}
        className="u-db"
      />
      <PdfTextLayer ref={textLayerRef} />
      {links.map((link, index) => (
        <PdfLinkArea
          key={index}
          href={link.url}
          label={link.url}
          left={link.left}
          top={link.top}
          width={link.width}
          height={link.height}
          onClick={handleLinkClick}
          data-testid="pdf-preview-link"
        />
      ))}
    </PdfPageFrame>
  )
}
