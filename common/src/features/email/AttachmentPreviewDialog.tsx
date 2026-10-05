import { Alert, CircularProgress } from '@linagora/twake-mui'
import type { EmailBodyPart } from 'jmap-client-ts'
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ReactElement
} from 'react'

import {
  FilePreviewDialog,
  FilePreviewSurface
} from '@/ds/FilePreviewDialog/FilePreviewDialog'
import { useComposer } from '@common/features/composer/ComposerProvider'
import { parseMailto } from '@common/features/composer/mailto'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import { saveBlob } from '@common/utils/saveBlob'

import {
  imageBlobType,
  MAX_TEXT_PREVIEW_BYTES,
  type PreviewKind
} from './attachmentPreview'
import { EmailBodyFrame } from './EmailBodyFrame'
import { buildEmailDocument } from './emailBody'
import { EmlPreview } from './EmlPreview'
import { sanitizeEmailHtml } from './sanitizeEmailHtml'

// pdf.js and its worker load with the first PDF only
const PdfPreview = lazy(async () => {
  const module = await import('./PdfPreview')
  return { default: module.PdfPreview }
})

export interface AttachmentPreviewDialogProps {
  part: EmailBodyPart
  kind: PreviewKind
  onClose: () => void
}

type Loaded =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; blob: Blob; bytes: Uint8Array }

function decodeText(bytes: Uint8Array, charset: string | null): string {
  const slice = bytes.subarray(0, MAX_TEXT_PREVIEW_BYTES)
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(slice)
  } catch {
    return new TextDecoder('utf-8').decode(slice)
  }
}

/**
 * A preview of an attachment in a full-screen dialog (tmail-flutter: PDF,
 * HTML, images, text and JSON; .eml opens in a window there and in the same
 * dialog here). The file is downloaded with the session, then shown by a
 * renderer that cannot run what the sender wrote:
 *
 * - HTML and .eml: the sanitizer, the CSP and the sandboxed frame of the
 *   email body, remote content blocked;
 * - images, SVG included: an `<img>`, where nothing runs and nothing else
 *   loads, from a blob of a known image type;
 * - text: escaped by React; PDF: drawn by pdf.js, see `PdfPreview`.
 *
 * No blob is ever navigated to, and each object URL is revoked on close.
 */
export function AttachmentPreviewDialog({
  part,
  kind,
  onClose
}: AttachmentPreviewDialogProps): ReactElement {
  const { t } = useI18n()
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const { openComposer } = useComposer()
  const name = part.name ?? t('email.attachment')
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!part.blobId) return
    const controller = new AbortController()
    client
      .download(
        { accountId, blobId: part.blobId, name, type: part.type },
        { signal: controller.signal }
      )
      .then(async blob => {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        setLoaded({ status: 'ready', blob, bytes })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error('[email] Attachment preview failed', error)
        setLoaded({ status: 'error' })
      })
    return () => {
      controller.abort()
    }
  }, [client, accountId, part.blobId, part.type, name])

  const imageUrl = useMemo(() => {
    if (loaded.status !== 'ready' || kind !== 'image') return null
    return URL.createObjectURL(
      loaded.blob.slice(0, loaded.blob.size, imageBlobType(part))
    )
  }, [loaded, kind, part])
  useEffect(
    () => () => {
      if (imageUrl !== null) URL.revokeObjectURL(imageUrl)
    },
    [imageUrl]
  )

  const htmlDocument = useMemo(() => {
    if (loaded.status !== 'ready' || kind !== 'html') return null
    const { html } = sanitizeEmailHtml(decodeText(loaded.bytes, part.charset), {
      autolink: true
    })
    return buildEmailDocument(html)
  }, [loaded, kind, part.charset])

  const handleDownload = (): void => {
    if (loaded.status === 'ready') saveBlob(loaded.blob, name)
  }
  const handleMailtoLink = (href: string): void => {
    const mailto = parseMailto(href)
    if (mailto === null) return
    onClose()
    openComposer({ mailto })
  }
  const handleFailed = (): void => {
    setFailed(true)
  }

  const renderContent = (): ReactElement => {
    if (loaded.status === 'loading') {
      return <CircularProgress aria-label={t('email.preview.loading')} />
    }
    if (loaded.status === 'error' || failed) {
      return (
        <Alert severity="warning" data-testid="attachment-preview-error">
          {kind === 'pdf'
            ? t('email.preview.cannotPreviewPdf')
            : kind === 'html'
              ? t('email.preview.cannotPreviewHtml')
              : t('email.preview.noPreview')}
        </Alert>
      )
    }
    switch (kind) {
      case 'image':
        return imageUrl === null ? (
          <></>
        ) : (
          <img
            src={imageUrl}
            alt={name}
            referrerPolicy="no-referrer"
            className="u-maw-100"
            onError={handleFailed}
            data-testid="attachment-preview-image"
          />
        )
      case 'text':
        return (
          <FilePreviewSurface kind="text" data-testid="attachment-preview-text">
            {decodeText(loaded.bytes, part.charset)}
            {loaded.bytes.length > MAX_TEXT_PREVIEW_BYTES
              ? `\n\n${t('email.preview.truncated')}`
              : ''}
          </FilePreviewSurface>
        )
      case 'pdf':
        return (
          <Suspense
            fallback={
              <CircularProgress aria-label={t('email.preview.loading')} />
            }
          >
            <PdfPreview bytes={loaded.bytes} onError={handleFailed} />
          </Suspense>
        )
      case 'html':
        return htmlDocument === null ? (
          <></>
        ) : (
          <FilePreviewSurface
            kind="document"
            data-testid="attachment-preview-html"
          >
            <EmailBodyFrame
              document={htmlDocument}
              onMailtoLink={handleMailtoLink}
            />
          </FilePreviewSurface>
        )
      case 'eml':
        return part.blobId ? (
          <EmlPreview
            blobId={part.blobId}
            onMailtoLink={handleMailtoLink}
            onError={handleFailed}
          />
        ) : (
          <></>
        )
    }
  }

  return (
    <FilePreviewDialog
      open
      title={name}
      closeLabel={t('common.close')}
      downloadLabel={
        loaded.status === 'ready' ? t('email.download') : undefined
      }
      onClose={onClose}
      onDownload={handleDownload}
      data-testid="attachment-preview"
    >
      {renderContent()}
    </FilePreviewDialog>
  )
}
