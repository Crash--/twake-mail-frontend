import { useEffect, useRef, useState, type ReactElement } from 'react'

import { LinkTooltip, type LinkRect } from '@/ds/LinkTooltip/LinkTooltip'
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
  /** A `mailto:` link of the email was followed: opens it in the app */
  onMailtoLink?: (href: string) => void
}

/**
 * Hands the `mailto:` links of the email document to `onMailtoLink` rather
 * than to the system (tmail-flutter `mailtoDelegate`). The listeners live in
 * the app: nothing runs in the frame
 */
export function interceptMailtoLinks(
  frameDocument: Document,
  onMailtoLink: (href: string) => void
): void {
  frameDocument.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href')?.trim() ?? ''
    if (!/^mailto:/i.test(href)) return
    link.addEventListener('click', event => {
      event.preventDefault()
      onMailtoLink(href)
    })
  })
}

/**
 * The keys pressed in the email document stay in the frame: Escape is
 * pressed again on the frame element, so that the shortcuts of the app
 * (back to the list) hear it. The listener lives in the app: nothing runs in
 * the frame
 */
export function forwardEscapeKey(
  frameDocument: Document,
  frame: HTMLIFrameElement
): void {
  frameDocument.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    // The window the frame is rendered in (the overlay of TwakeSpace)
    const view = frame.ownerDocument.defaultView ?? window
    frame.dispatchEvent(
      new view.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true
      })
    )
  })
}

/**
 * Reports the link under the pointer or holding the focus in the email
 * document, its place in the window of `frame`, and null once left
 */
function followLinks(
  frameDocument: Document,
  frame: HTMLIFrameElement,
  onLink: (link: { href: string; rect: LinkRect } | null) => void
): void {
  const show = (target: EventTarget | null): void => {
    // The elements of the frame are of its own window
    const FrameElement = frameDocument.defaultView?.Element
    const link =
      FrameElement !== undefined && target instanceof FrameElement
        ? target.closest('a[href]')
        : null
    const href = link?.getAttribute('href') ?? ''
    if (link === null || href === '' || href.startsWith('#')) {
      onLink(null)
      return
    }
    const frameBox = frame.getBoundingClientRect()
    const box = link.getBoundingClientRect()
    onLink({
      href,
      rect: {
        top: frameBox.top + box.top,
        left: frameBox.left + box.left,
        bottom: frameBox.top + box.bottom
      }
    })
  }
  frameDocument.addEventListener('mouseover', event => {
    show(event.target)
  })
  frameDocument.addEventListener('focusin', event => {
    show(event.target)
  })
  // The reading pane scrolls with the wheel over the frame: the link moves
  for (const type of ['focusout', 'wheel'] as const) {
    frameDocument.addEventListener(type, () => {
      onLink(null)
    })
  }
}

/**
 * The body of an email, isolated in a sandboxed iframe whose height follows
 * its content, so that the reading pane scrolls as one page. As
 * tmail-flutter, the address of a link shows in a tooltip while the pointer
 * is on it.
 */
export function EmailBodyFrame({
  document,
  onMailtoLink
}: EmailBodyFrameProps): ReactElement {
  const { t } = useI18n()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const onMailtoLinkRef = useRef(onMailtoLink)
  const [height, setHeight] = useState(MIN_HEIGHT)
  const [link, setLink] = useState<{ href: string; rect: LinkRect } | null>(
    null
  )

  useEffect(() => {
    onMailtoLinkRef.current = onMailtoLink
  }, [onMailtoLink])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  // Loaded from a blob: URL rather than `srcdoc`: Chromium sends the origin
  // of the app as referrer for the CSS images of a srcdoc frame, whatever
  // its referrer policy; a blob: document sends none
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const objectUrl = URL.createObjectURL(
      new Blob([document], { type: 'text/html' })
    )
    frame.src = objectUrl
    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [document])

  const handleLoad = (): void => {
    observerRef.current?.disconnect()
    observerRef.current = null
    const frame = frameRef.current
    const frameDocument = frame?.contentDocument
    const content = frameDocument?.getElementById(EMAIL_CONTENT_ID)
    if (!frame || !frameDocument || !content) return

    forwardEscapeKey(frameDocument, frame)
    setLink(null)
    followLinks(frameDocument, frame, setLink)

    if (onMailtoLinkRef.current) {
      interceptMailtoLinks(frameDocument, href => {
        onMailtoLinkRef.current?.(href)
      })
    }

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
    // The window the node is rendered in, maybe not this one (the overlay of
    // TwakeSpace): an observer only follows the documents of its own window
    const view = frameRef.current?.ownerDocument.defaultView ?? window
    const observer = new view.ResizeObserver(measure)
    observer.observe(content)
    observerRef.current = observer
  }

  return (
    <>
      <iframe
        ref={frameRef}
        title={t('email.content')}
        sandbox={EMAIL_FRAME_SANDBOX}
        referrerPolicy="no-referrer"
        width="100%"
        height={height}
        className="u-db u-bdw-0"
        onLoad={handleLoad}
        data-testid="email-view-body"
        onMouseLeave={() => {
          setLink(null)
        }}
      />
      {link === null ? null : (
        <LinkTooltip
          href={link.href}
          rect={link.rect}
          data-testid="email-link-tooltip"
        />
      )}
    </>
  )
}
