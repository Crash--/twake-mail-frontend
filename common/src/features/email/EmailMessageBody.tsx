import { Box, Divider, ListSkeleton } from '@linagora/twake-mui'
import { useMemo, useState, type ReactElement } from 'react'

import { isUnnamedCalendarPart } from '@common/features/calendar/calendarBlobs'
import {
  CalendarInvitationCard,
  useCalendarInvitation
} from '@common/features/calendar/CalendarInvitationCard'
import { useComposer } from '@common/features/composer/ComposerProvider'
import { parseMailto } from '@common/features/composer/mailto'
import { useFocusIndicator } from '@common/features/settings/accessibilityPreference'
import { useI18n } from '@common/i18n/useI18n'

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
import { UnsubscribedBanner } from './UnsubscribedBanner'
import { foldQuotedHistory } from './quoteToggle'
import { normalizeCid } from './sanitizeEmailHtml'
import { useTrustedSender } from './trustedSenders'
import { useInlineImageUrls } from './useInlineImageUrls'

export interface EmailMessageBodyProps {
  email: EmailDetail
  /**
   * The remote content banner went away with its buttons: where the focus
   * goes next
   */
  onRemoteContentShown: () => void
}

/**
 * What an email says: the card of its calendar event, the remote content
 * banner, the sanitized body with its inline images, and its attachments
 * under it, as in the mocks. Remote content (images, fonts,
 * backgrounds) tells the sender when and where the email is read: it waits
 * for the user, unless the sender is trusted.
 */
export function EmailMessageBody({
  email,
  onRemoteContentShown
}: EmailMessageBodyProps): ReactElement {
  const { t } = useI18n()
  const sender = email.from?.[0] ?? null
  const html = useMemo(
    () => joinHtmlValues(email.htmlBody, email.bodyValues),
    [email.htmlBody, email.bodyValues]
  )
  const referencedCids = useMemo(() => findReferencedCids(html), [html])
  const inlineImages = useInlineImageUrls(email.attachments, referencedCids)
  const trustedSender = useTrustedSender(sender?.email ?? null)
  const calendar = useCalendarInvitation(email.attachments)
  const { openComposer } = useComposer()
  const [isRemoteContentShown, setIsRemoteContentShown] = useState(false)
  const allowRemoteContent = isRemoteContentShown || trustedSender.isTrusted
  const focusIndicator = useFocusIndicator()
  const trimmedContentLabel = t('email.showTrimmedContent')
  const body = useMemo(() => {
    if (inlineImages.isLoading) return null
    const rendered = renderBodyParts(email.htmlBody, email.bodyValues, {
      inlineImageUrls: inlineImages.urls,
      allowRemoteContent,
      normalizeImageSizes: true
    })
    // The quoted history of an answer is folded behind "•••"
    const content = foldQuotedHistory(rendered.html, trimmedContentLabel)
    return {
      document: buildEmailDocument(content, {
        allowRemoteContent,
        focusIndicator
      }),
      hasBlockedRemoteContent: rendered.blockedRemoteContent > 0
    }
  }, [
    email.htmlBody,
    email.bodyValues,
    inlineImages.isLoading,
    inlineImages.urls,
    allowRemoteContent,
    focusIndicator,
    trimmedContentLabel
  ])
  // Inline images are shown in the body, not listed as attachments; nor
  // is the nameless calendar part the event card shows
  const attachments = email.attachments.filter(
    part =>
      (!part.cid || !referencedCids.has(normalizeCid(part.cid))) &&
      !(calendar.invitation !== null && isUnnamedCalendarPart(part))
  )

  const handleShowRemoteContent = (): void => {
    setIsRemoteContentShown(true)
    onRemoteContentShown()
  }
  const handleAlwaysShowRemoteContent = (): void => {
    trustedSender.trust()
    handleShowRemoteContent()
  }
  // The links of the email write a message with the app, not with the system
  const handleMailtoLink = (href: string): void => {
    const mailto = parseMailto(href)
    if (mailto !== null) openComposer({ mailto })
  }

  return (
    <>
      <UnsubscribedBanner email={email} />
      {calendar.invitation ? (
        <Box className="u-mt-1">
          <CalendarInvitationCard
            invitation={calendar.invitation}
            blobIds={calendar.blobIds}
            from={email.from}
            replyTo={email.replyTo}
          />
        </Box>
      ) : null}
      {body?.hasBlockedRemoteContent ? (
        <RemoteContentBanner
          onShow={handleShowRemoteContent}
          onAlwaysShow={sender ? handleAlwaysShowRemoteContent : null}
        />
      ) : null}
      {body === null ? (
        <ListSkeleton count={3} />
      ) : (
        <EmailBodyFrame
          document={body.document}
          onMailtoLink={handleMailtoLink}
        />
      )}
      {attachments.length > 0 ? <Divider className="u-mt-1" /> : null}
      <AttachmentList attachments={attachments} emailId={email.id} />
    </>
  )
}
