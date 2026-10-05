import { CircularProgress } from '@linagora/twake-mui'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useEffect, useRef, useState, type ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

import { ANNOTATIONS_DISABLED, loadPdf } from './pdfjs'

export interface PdfPreviewProps {
  bytes: Uint8Array
  onError: () => void
}

const MAX_PAGE_WIDTH = 900

/**
 * A PDF drawn on canvases by pdf.js, in the app and not in a browser plugin:
 * the document never runs a script (no JavaScript actions, no forms, no
 * annotations), and a browser PDF viewer cannot be used in a sandboxed
 * frame nor under the CSP `object-src 'none'`.
 */
export function PdfPreview({ bytes, onError }: PdfPreviewProps): ReactElement {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const onErrorRef = useRef(onError)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    const state = { isCancelled: false }
    let destroy: (() => Promise<void>) | null = null
    // pdf.js takes the buffer over: it gets a copy
    loadPdf(bytes.slice())
      .then(loaded => {
        destroy = loaded.destroy
        if (!state.isCancelled) setPdf(loaded.pdf)
      })
      .catch((error: unknown) => {
        if (state.isCancelled) return
        console.error('[email] PDF preview failed', error)
        onErrorRef.current()
      })
    return () => {
      state.isCancelled = true
      setPdf(null)
      void destroy?.()
    }
  }, [bytes])

  // Once the canvases are in the page
  useEffect(() => {
    const container = containerRef.current
    if (!pdf || !container) return
    const state = { isCancelled: false }
    const ratio = window.devicePixelRatio || 1
    const draw = async (): Promise<void> => {
      for (let number = 1; number <= pdf.numPages; number += 1) {
        const page = await pdf.getPage(number)
        if (state.isCancelled) return
        const canvas = container.querySelector<HTMLCanvasElement>(
          `canvas[data-page="${number}"]`
        )
        const context = canvas?.getContext('2d')
        if (!canvas || !context) continue
        const width = Math.min(window.innerWidth - 64, MAX_PAGE_WIDTH)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({
          scale: (width / base.width) * ratio
        })
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = `${Math.floor(viewport.width / ratio)}px`
        await page.render({
          canvas,
          canvasContext: context,
          viewport,
          annotationMode: ANNOTATIONS_DISABLED
        }).promise
      }
    }
    draw().catch((error: unknown) => {
      if (state.isCancelled) return
      console.error('[email] PDF preview failed', error)
      onErrorRef.current()
    })
    return () => {
      state.isCancelled = true
    }
  }, [pdf])

  return (
    <div ref={containerRef} className="u-w-100" data-testid="pdf-preview">
      {pdf === null ? (
        <CircularProgress aria-label={t('email.preview.loading')} />
      ) : (
        Array.from({ length: pdf.numPages }, (_unused, index) => (
          <canvas
            key={index}
            data-page={index + 1}
            role="img"
            aria-label={t('email.preview.page', {
              page: index + 1,
              count: pdf.numPages
            })}
            className="u-db u-mb-1"
          />
        ))
      )}
    </div>
  )
}
