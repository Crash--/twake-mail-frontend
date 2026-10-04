import { useEffect, useRef, useState, type ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

import { EMAIL_CONTENT_ID } from './emailBody'

/**
 * No `allow-scripts`: nothing in the email can run, even if sanitization
 * missed it. `allow-same-origin` only lets the app measure the content (no
 * script runs inside to abuse it). Links open in a new tab that is not
 * sandboxed.
 */
export const EMAIL_FRAME_SANDBOX =
  'allow-same-origin allow-popups allow-popups-to-escape-sandbox'

const MIN_HEIGHT = 32

export interface EmailBodyFrameProps {
  /** The whole document, from `buildEmailDocument` */
  document: string
}

/**
 * The body of an email, isolated in a sandboxed iframe whose height follows
 * its content, so that the reading pane scrolls as one page.
 */
export function EmailBodyFrame({
  document
}: EmailBodyFrameProps): ReactElement {
  const { t } = useI18n()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const [height, setHeight] = useState(MIN_HEIGHT)

  useEffect(() => () => observerRef.current?.disconnect(), [])

  const handleLoad = (): void => {
    observerRef.current?.disconnect()
    observerRef.current = null
    const content =
      frameRef.current?.contentDocument?.getElementById(EMAIL_CONTENT_ID)
    if (!content) return

    // The wrapper, not the document: a body sized on the viewport
    // (`min-height: 100vh`) would grow the frame at each measure
    const measure = (): void => {
      const contentHeight = Math.ceil(content.getBoundingClientRect().height)
      setHeight(previous =>
        Math.abs(previous - contentHeight) > 1
          ? Math.max(contentHeight, MIN_HEIGHT)
          : previous
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    observerRef.current = observer
  }

  return (
    <iframe
      ref={frameRef}
      title={t('email.content')}
      sandbox={EMAIL_FRAME_SANDBOX}
      srcDoc={document}
      width="100%"
      height={height}
      className="u-db u-bdw-0"
      onLoad={handleLoad}
      data-testid="email-view-body"
    />
  )
}
