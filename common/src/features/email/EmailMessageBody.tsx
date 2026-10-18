import { Box, Divider } from '@linagora/twake-mui'
import { useMemo, type ReactElement } from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { isUnnamedCalendarPart } from '@common/features/calendar/calendarBlobs'
import {
  CalendarInvitationCard,
  useCalendarInvitation
} from '@common/features/calendar/CalendarInvitationCard'
import { useComposer } from '@common/features/composer/ComposerProvider'
import { parseMailto } from '@common/features/composer/mailto'
import { LoadingListSkeleton } from '@common/features/loading/LoadingListSkeleton'
import { useFocusIndicator } from '@common/features/settings/accessibilityPreference'
import { useShowsRemoteImages } from '@common/features/settings/serverSettings'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { AttachmentList } from './AttachmentList'
import { BodyLoadErrorBanner } from './BodyLoadErrorBanner'
import { EmailBodyFrame } from './EmailBodyFrame'
import {
  buildEmailDocument,
  findReferencedCids,
  inspectBodyValues,
  joinHtmlValues,
  renderBodyParts
} from './emailBody'
import type { EmailDetail } from './queries'
import { RemoteContentBanner } from './RemoteContentBanner'
import { UnsubscribedBanner } from './UnsubscribedBanner'
import { foldQuotedHistory } from './quoteToggle'
import { useRemoteContentConsent } from './remoteContentConsent'
import { allowsRemoteContent } from './remoteContentPolicy'
import { normalizeCid } from './sanitizeEmailHtml'
import { useTrustedSender } from './trustedSenders'
import { TruncatedBodyBanner } from './TruncatedBodyBanner'
import { useDownloadEml } from './useDownloadEml'
import { useEmail } from './useEmail'
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
 * What an email says, in the order of tmail-flutter: its attachments, the
 * card of its calendar event, the remote content banner, then the sanitized
 * body with its inline images. On phones the attachments go after the body,
 * as tmail-flutter does (issue #315: above it, a long email no longer hides
 * them). Remote content (images, fonts,
 * backgrounds) tells the sender when and where the email is read: it waits
 * for the user, unless they want it for every email or the sender is
 * trusted (`allowsRemoteContent`). A body the server could not give says
 * so, never shows as an empty message (tmail-flutter `tf#3487`).
 */
export function EmailMessageBody({
  email,
  onRemoteContentShown
}: EmailMessageBodyProps): ReactElement {
  const { t } = useI18n()
  const isPhone = useScreenSize() === 'mobile'
  const sender = email.from?.[0] ?? null
  const html = useMemo(
    () => joinHtmlValues(email.htmlBody, email.bodyValues),
    [email.htmlBody, email.bodyValues]
  )
  const referencedCids = useMemo(() => findReferencedCids(html), [html])
  const issues = useMemo(
    () => inspectBodyValues(email.htmlBody, email.bodyValues),
    [email.htmlBody, email.bodyValues]
  )
  // The email in the cache, to ask for it again
  const { refetch } = useEmail(email.id)
  const downloadEml = useDownloadEml()
  const inlineImages = useInlineImageUrls(email.attachments, referencedCids)
  const trustedSender = useTrustedSender(sender?.email ?? null)
  const calendar = useCalendarInvitation(email.attachments)
  const { openComposer } = useComposer()
  const [isRemoteContentShown, showRemoteContent] = useRemoteContentConsent(
    email.id
  )
  const { session } = useJmapSession()
  const isAlwaysShown = useShowsRemoteImages()
  const allowRemoteContent = allowsRemoteContent({
    isAlwaysShown,
    isConsented: isRemoteContentShown,
    isTrustedSender: trustedSender.isTrusted,
    senderEmail: sender?.email ?? null,
    userEmail: session.username
  })
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
    showRemoteContent()
    onRemoteContentShown()
  }
  const handleAlwaysShowRemoteContent = (): void => {
    trustedSender.trust()
    handleShowRemoteContent()
  }
  const handleRetry = (): void => {
    void refetch()
  }
  const handleDownloadEml = (): void => {
    void downloadEml(email)
  }
  // The links of the email write a message with the app, not with the system
  const handleMailtoLink = (href: string): void => {
    const mailto = parseMailto(href)
    if (mailto !== null) openComposer({ mailto })
  }

  // What the server gave of a body it could not give whole, nothing when
  // it gave nothing
  let bodyView: ReactElement | null = null
  if (body === null) bodyView = <LoadingListSkeleton count={3} />
  else if (issues.hasValues || !issues.hasMissingValues) {
    bodyView = (
      <EmailBodyFrame
        document={body.document}
        onMailtoLink={handleMailtoLink}
      />
    )
  }

  return (
    <>
      <UnsubscribedBanner email={email} />
      {isPhone ? null : (
        <AttachmentList attachments={attachments} emailId={email.id} />
      )}
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
      {issues.isTruncated ? (
        <TruncatedBodyBanner
          onDownload={email.blobId ? handleDownloadEml : null}
        />
      ) : null}
      {/* tmail-flutter leaves room between the headers and the body */}
      <Box className="u-mt-1">
        {issues.hasMissingValues ? (
          <BodyLoadErrorBanner onRetry={handleRetry} />
        ) : null}
        {bodyView}
      </Box>
      {isPhone ? (
        <>
          {attachments.length > 0 ? <Divider className="u-mt-1" /> : null}
          <AttachmentList attachments={attachments} emailId={email.id} />
        </>
      ) : null}
    </>
  )
}
