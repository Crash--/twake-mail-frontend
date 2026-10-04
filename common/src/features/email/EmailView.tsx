import { EmailOpen, Icon, Left } from '@linagora/twake-icons'
import {
  Avatar,
  Box,
  Divider,
  Empty,
  getInitials,
  IconButton,
  ListSkeleton,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import type { EmailAddress } from 'jmap-client-ts'
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { MessageHeader } from '@/ds/MessageHeader/MessageHeader'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useDocumentTitle } from '@common/app/useDocumentTitle'
import type { EmailListLocationState } from '@common/features/thread/EmailList'
import { formatFullDate } from '@common/features/thread/formatListDate'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'

import { formatAddress, formatAddressName } from './addresses'
import { AttachmentList } from './AttachmentList'
import { EmailBodyFrame } from './EmailBodyFrame'
import {
  buildEmailDocument,
  findReferencedCids,
  joinHtmlValues,
  renderBodyParts
} from './emailBody'
import type { EmailDetail } from './queries'
import { RemoteContentBanner } from './RemoteContentBanner'
import { normalizeCid } from './sanitizeEmailHtml'
import { useTrustedSender } from './trustedSenders'
import { useEmail } from './useEmail'
import { useInlineImageUrls } from './useInlineImageUrls'
import { useMarkAsReadOnOpen } from './useMarkAsReadOnOpen'

interface AddressLineProps {
  label: TranslationKey
  addresses: readonly EmailAddress[] | null
  'data-testid': string
}

function AddressLine({
  label,
  addresses,
  'data-testid': testId
}: AddressLineProps): ReactElement | null {
  const { t } = useI18n()
  if (!addresses || addresses.length === 0) return null
  return (
    <SecondaryText variant="body2" component="p" data-testid={testId}>
      {t(label)}:{' '}
      {addresses.map((address, index) => (
        <span key={`${address.email}-${index}`} title={address.email}>
          {index > 0 ? ', ' : null}
          {formatAddress(address)}
        </span>
      ))}
    </SecondaryText>
  )
}

interface EmailContentProps {
  email: EmailDetail
  onBack: () => void
}

function EmailContent({ email, onBack }: EmailContentProps): ReactElement {
  const { t, lang } = useI18n()
  useMarkAsReadOnOpen(email)
  const sender = email.from?.[0] ?? null
  const html = useMemo(
    () => joinHtmlValues(email.htmlBody, email.bodyValues),
    [email.htmlBody, email.bodyValues]
  )
  const referencedCids = useMemo(() => findReferencedCids(html), [html])
  const inlineImages = useInlineImageUrls(email.attachments, referencedCids)
  // Remote content tells the sender when and where the email is read: it
  // waits for the user, unless the sender is trusted
  const trustedSender = useTrustedSender(sender?.email ?? null)
  const [isRemoteContentShown, setIsRemoteContentShown] = useState(false)
  const allowRemoteContent = isRemoteContentShown || trustedSender.isTrusted
  const body = useMemo(() => {
    if (inlineImages.isLoading) return null
    const rendered = renderBodyParts(email.htmlBody, email.bodyValues, {
      inlineImageUrls: inlineImages.urls,
      allowRemoteContent
    })
    return {
      document: buildEmailDocument(rendered.html, { allowRemoteContent }),
      hasBlockedRemoteContent: rendered.blockedRemoteContent > 0
    }
  }, [
    email.htmlBody,
    email.bodyValues,
    inlineImages.isLoading,
    inlineImages.urls,
    allowRemoteContent
  ])
  // Inline images are shown in the body, not listed as attachments
  const attachments = email.attachments.filter(
    part => !part.cid || !referencedCids.has(normalizeCid(part.cid))
  )
  const backLabel = t('common.back')
  useDocumentTitle(email.subject ?? '')
  const subjectRef = useRef<HTMLHeadingElement>(null)

  // The list the email replaces is gone: the focus moves to the subject,
  // where a screen reader starts reading the email
  useEffect(() => {
    subjectRef.current?.focus()
  }, [])

  // The banner goes away with its buttons: the focus goes back to the email
  const handleShowRemoteContent = (): void => {
    setIsRemoteContentShown(true)
    subjectRef.current?.focus()
  }
  const handleAlwaysShowRemoteContent = (): void => {
    trustedSender.trust()
    handleShowRemoteContent()
  }

  return (
    <Box className="u-p-1" data-testid="email-view">
      <Box className="u-flex u-flex-items-center u-mb-1">
        <Tooltip title={backLabel}>
          <IconButton
            aria-label={backLabel}
            onClick={onBack}
            data-testid="email-view-back-button"
          >
            <Icon icon={Left} />
          </IconButton>
        </Tooltip>
      </Box>
      <Box className="u-ph-1">
        <Typography
          ref={subjectRef}
          variant="h3"
          component="h1"
          tabIndex={-1}
          className="u-breakword"
          data-testid="email-view-subject"
        >
          {email.subject ?? ''}
        </Typography>
        <MessageHeader
          className="u-mt-1"
          avatar={
            <Avatar>
              {getInitials(sender?.name ?? '', sender?.email ?? '')}
            </Avatar>
          }
          identity={
            <>
              <Typography data-testid="email-view-from">
                {sender ? (
                  <>
                    <span className="u-fw-bold">
                      {formatAddressName(sender)}
                    </span>
                    {sender.name ? (
                      <SecondaryText>{` <${sender.email}>`}</SecondaryText>
                    ) : null}
                  </>
                ) : null}
              </Typography>
              <AddressLine
                label="email.to"
                addresses={email.to}
                data-testid="email-view-to"
              />
              <AddressLine
                label="email.cc"
                addresses={email.cc}
                data-testid="email-view-cc"
              />
              <AddressLine
                label="email.bcc"
                addresses={email.bcc}
                data-testid="email-view-bcc"
              />
            </>
          }
          date={
            <SecondaryText variant="caption" data-testid="email-view-date">
              <time dateTime={email.receivedAt}>
                {formatFullDate(email.receivedAt, lang)}
              </time>
            </SecondaryText>
          }
        />
        <AttachmentList attachments={attachments} />
        <Divider className="u-mv-1" />
        {body?.hasBlockedRemoteContent ? (
          <RemoteContentBanner
            onShow={handleShowRemoteContent}
            onAlwaysShow={sender ? handleAlwaysShowRemoteContent : null}
          />
        ) : null}
        {body === null ? (
          <ListSkeleton count={3} />
        ) : (
          <EmailBodyFrame document={body.document} />
        )}
      </Box>
    </Box>
  )
}

export interface EmailViewProps {
  mailboxId: string
  emailId: string
}

/**
 * An opened email: headers, attachments and body. Replaces the list, as in
 * tmail-flutter on desktop; the back button returns to the mailbox.
 */
export function EmailView({
  mailboxId,
  emailId
}: EmailViewProps): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const query = useEmail(emailId)

  const handleBack = (): void => {
    void navigate(`/mailbox/${encodeURIComponent(mailboxId)}`, {
      state: { focusEmailId: emailId } satisfies EmailListLocationState
    })
  }

  if (query.isPending) {
    return (
      <Box className="u-p-2" data-testid="email-view-loading">
        <ListSkeleton count={4} hasSecondary />
      </Box>
    )
  }

  if (query.isError) {
    const handleRetry = (): void => {
      void query.refetch()
    }
    return (
      <ErrorScreen
        title={t('common.errorOccurred')}
        actionLabel={t('common.retry')}
        onAction={handleRetry}
        data-testid="email-view-error"
      />
    )
  }

  if (query.data === null) {
    return (
      <Empty
        icon={EmailOpen}
        title={t('email.notFound')}
        data-testid="email-not-found"
      />
    )
  }

  // A new email starts with its own choices (remote content)
  return (
    <EmailContent key={query.data.id} email={query.data} onBack={handleBack} />
  )
}
