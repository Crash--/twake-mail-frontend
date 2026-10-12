import { CircularProgress } from '@linagora/twake-mui'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useEffect, useRef, useState, type ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

import { fitPage } from './pdfLayout'
import { PdfPage } from './PdfPage'
import { PdfPasswordForm } from './PdfPasswordForm'
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

interface PasswordPrompt {
  /** A new form for each attempt: empty, and focused again */
  attempt: number
  isRetry: boolean
  answer: (password: string) => void
}

/**
 * A PDF drawn on canvases by pdf.js, in the app and not in a browser plugin:
 * the document never runs a script (no JavaScript actions, no forms, no
 * annotations), and a browser PDF viewer cannot be used in a sandboxed
 * frame nor under the CSP `object-src 'none'`. The pages are drawn when
 * scrolled into view (`PdfPage`); closing the preview terminates the worker,
 * even while the document is still loading. An encrypted document asks its
 * password first, again while it is wrong.
 */
export function PdfPreview({ bytes, onError }: PdfPreviewProps): ReactElement {
  const { t } = useI18n()
  const onErrorRef = useRef(onError)
  const rootRef = useRef<HTMLDivElement>(null)
  const [opened, setOpened] = useState<Opened | null>(null)
  const [passwordPrompt, setPasswordPrompt] = useState<PasswordPrompt | null>(
    null
  )

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    let isCancelled = false
    let giveUpPassword: (() => void) | null = null
    let attempt = 0
    const requestPassword = (isRetry: boolean): Promise<string | null> =>
      new Promise(resolve => {
        if (isCancelled) {
          resolve(null)
          return
        }
        giveUpPassword = () => {
          resolve(null)
        }
        attempt += 1
        setPasswordPrompt({
          attempt,
          isRetry,
          answer: password => {
            giveUpPassword = null
            setPasswordPrompt(null)
            resolve(password)
          }
        })
      })
    // pdf.js takes the buffer over: it gets a copy
    const load = loadPdf(bytes.slice(), requestPassword)
    const open = async (): Promise<void> => {
      const { pdf } = await load.promise
      const first = await pdf.getPage(1)
      const base = first.getViewport({ scale: 1 })
      // The window the preview is rendered in: maybe the overlay of
      // TwakeSpace, wider than this frame
      const view = rootRef.current?.ownerDocument.defaultView ?? window
      const cssWidth = Math.min(view.innerWidth - 64, MAX_PAGE_WIDTH)
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
      setPasswordPrompt(null)
      giveUpPassword?.()
      load.destroy().catch((error: unknown) => {
        console.error('[email] PDF worker not stopped', error)
      })
    }
  }, [bytes])

  const handlePageError = (): void => {
    onErrorRef.current()
  }

  return (
    <div ref={rootRef} className="u-w-100" data-testid="pdf-preview">
      {passwordPrompt !== null ? (
        <PdfPasswordForm
          key={passwordPrompt.attempt}
          isRetry={passwordPrompt.isRetry}
          onSubmit={passwordPrompt.answer}
        />
      ) : opened === null ? (
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
