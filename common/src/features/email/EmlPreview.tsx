import { CircularProgress, Typography } from '@linagora/twake-mui'
import { useQuery } from '@tanstack/react-query'
import type { Email, EmailAddress } from 'jmap-client-ts'
import { useEffect, useMemo, type ReactElement } from 'react'

import { FilePreviewSurface } from '@/ds/FilePreviewDialog/FilePreviewDialog'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { AttachmentList } from './AttachmentList'
import { formatAddress } from './addresses'
import { buildEmailDocument, renderBodyParts } from './emailBody'
import { EmailBodyFrame } from './EmailBodyFrame'

export interface EmlPreviewProps {
  /** The blob of the .eml attachment */
  blobId: string
  onMailtoLink: (href: string) => void
  onError: () => void
}

const EML_PROPERTIES = [
  'subject',
  'from',
  'to',
  'cc',
  'sentAt',
  'htmlBody',
  'textBody',
  'attachments',
  'bodyValues'
] as const

function formatAddresses(addresses: readonly EmailAddress[] | null): string {
  return (addresses ?? []).map(formatAddress).join(', ')
}

/**
 * A .eml attachment, parsed by the server (`Email/parse`, as tmail-flutter)
 * and shown like an email: its body goes through the sanitizer and the
 * sandboxed frame of the email view, remote content blocked.
 */
export function EmlPreview({
  blobId,
  onMailtoLink,
  onError
}: EmlPreviewProps): ReactElement {
  const { t, lang } = useI18n()
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const query = useQuery({
    queryKey: ['email', accountId, 'parse', blobId],
    queryFn: async ({ signal }): Promise<Email> => {
      const response = await client.call(
        'Email/parse',
        {
          accountId,
          blobIds: [blobId],
          properties: [...EML_PROPERTIES],
          fetchHTMLBodyValues: true
        },
        { signal }
      )
      const email = response.parsed?.[blobId]
      if (!email) throw new Error('The .eml attachment cannot be parsed')
      return email
    },
    retry: false
  })
  const { isError } = query
  useEffect(() => {
    if (isError) onError()
  }, [isError, onError])

  const email = query.data
  const document = useMemo(() => {
    if (!email) return null
    const bodyParts =
      email.htmlBody.length > 0 ? email.htmlBody : email.textBody
    const { html } = renderBodyParts(bodyParts, email.bodyValues)
    return buildEmailDocument(html)
  }, [email])

  if (!email || !document) {
    return <CircularProgress aria-label={t('email.preview.loading')} />
  }
  const sentAt = email.sentAt
    ? new Intl.DateTimeFormat(lang, {
        dateStyle: 'long',
        timeStyle: 'short'
      }).format(new Date(email.sentAt))
    : null
  const header: [string, string][] = [
    [t('email.from'), formatAddresses(email.from)],
    [t('email.to'), formatAddresses(email.to)],
    [t('email.cc'), formatAddresses(email.cc)]
  ]
  return (
    <FilePreviewSurface kind="document" data-testid="attachment-preview-eml">
      <Typography variant="h6" component="h3">
        {email.subject ?? ''}
      </Typography>
      {header
        .filter(([, value]) => value !== '')
        .map(([label, value]) => (
          <Typography key={label} variant="body2">
            <b>{label}</b> {value}
          </Typography>
        ))}
      {sentAt ? <Typography variant="body2">{sentAt}</Typography> : null}
      <AttachmentList attachments={email.attachments} />
      <EmailBodyFrame document={document} onMailtoLink={onMailtoLink} />
    </FilePreviewSurface>
  )
}
