import { CircularProgress } from '@linagora/twake-mui'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useEffect, useRef, useState, type ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

import { fitPage } from './pdfLayout'
import { PdfPage } from './PdfPage'
import { loadPdf } from './pdfjs'

export interface PdfPreviewProps {
  bytes: Uint8Array
  onError: () => void
}

const MAX_PAGE_WIDTH = 900

interface Opened {
  pdf: PDFDocumentProxy
  cssWidth: number
  /** Height of every page until it is drawn: the first page's */
  estimatedHeight: number
}

/**
 * A PDF drawn on canvases by pdf.js, in the app and not in a browser plugin:
 * the document never runs a script (no JavaScript actions, no forms, no
 * annotations), and a browser PDF viewer cannot be used in a sandboxed
 * frame nor under the CSP `object-src 'none'`. The pages are drawn when
 * scrolled into view (`PdfPage`); closing the preview terminates the worker,
 * even while the document is still loading.
 */
export function PdfPreview({ bytes, onError }: PdfPreviewProps): ReactElement {
  const { t } = useI18n()
  const onErrorRef = useRef(onError)
  const [opened, setOpened] = useState<Opened | null>(null)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    let isCancelled = false
    // pdf.js takes the buffer over: it gets a copy
    const load = loadPdf(bytes.slice())
    const open = async (): Promise<void> => {
      const { pdf } = await load.promise
      const first = await pdf.getPage(1)
      const base = first.getViewport({ scale: 1 })
      const cssWidth = Math.min(window.innerWidth - 64, MAX_PAGE_WIDTH)
      const layout = fitPage(base.width, base.height, cssWidth, 1)
      if (layout === null) throw new Error('PDF page without a size')
      if (!isCancelled) {
        setOpened({ pdf, cssWidth, estimatedHeight: layout.cssHeight })
      }
    }
    open().catch((error: unknown) => {
      if (isCancelled) return
      console.error('[email] PDF preview failed', error)
      onErrorRef.current()
    })
    return () => {
      isCancelled = true
      setOpened(null)
      load.destroy().catch((error: unknown) => {
        console.error('[email] PDF worker not stopped', error)
      })
    }
  }, [bytes])

  const handlePageError = (): void => {
    onErrorRef.current()
  }

  return (
    <div className="u-w-100" data-testid="pdf-preview">
      {opened === null ? (
        <CircularProgress aria-label={t('email.preview.loading')} />
      ) : (
        Array.from({ length: opened.pdf.numPages }, (_unused, index) => (
          <PdfPage
            key={index}
            pdf={opened.pdf}
            number={index + 1}
            cssWidth={opened.cssWidth}
            estimatedHeight={opened.estimatedHeight}
            onError={handlePageError}
          />
        ))
      )}
    </div>
  )
}
