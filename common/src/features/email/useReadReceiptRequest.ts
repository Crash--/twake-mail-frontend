import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { useConfirm } from '@common/features/confirm/ConfirmProvider'
import { identityForEmail } from '@common/features/identities/identityForEmail'
import { useIdentities } from '@common/features/identities/useIdentities'
import { findMailboxIdByRole } from '@common/features/mailbox/mailboxTree'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { formatFullDate } from '@common/features/thread/formatListDate'

import { DRAFT } from './keywords'
import { emailKeys, READ_RECEIPT_HEADER, type EmailDetail } from './queries'

/** RFC 9007 */
export const MDN_CAPABILITY = 'urn:ietf:params:jmap:mdn'

/** The keyword of an email whose read receipt was sent (RFC 9007) */
export const MDN_SENT = '$mdnsent'

/**
 * Whether the read receipt of the email was sent, by this app or another
 * client: keywords are case-insensitive (RFC 8621 §4.1.1), and an IMAP
 * client sets `$MDNSent` (RFC 3503), which a server may give back as is
 */
export function hasMdnSent(email: Pick<EmailDetail, 'keywords'>): boolean {
  return Object.keys(email.keywords).some(
    keyword => keyword.toLowerCase() === MDN_SENT
  )
}

/**
 * Whether an opened email asks for a read receipt still to send, as
 * tmail-flutter decides (`hasReadReceipt`): it has a
 * `Disposition-Notification-To`, no `$mdnsent` (whatever its case), and is not in Sent nor a
 * draft (the user asked for a receipt on a message not sent yet).
 */
export function asksReadReceipt(
  email: Pick<EmailDetail, 'keywords' | 'mailboxIds'> &
    Pick<Partial<EmailDetail>, typeof READ_RECEIPT_HEADER>,
  sentId: string | null
): boolean {
  return (
    (email[READ_RECEIPT_HEADER] ?? '').trim() !== '' &&
    !hasMdnSent(email) &&
    !(DRAFT in email.keywords) &&
    !(sentId !== null && sentId in email.mailboxIds)
  )
}

/**
 * Asks, once the email is open, whether to send the read receipt its
 * sender requested (tmail-flutter): "Yes" sends it (`MDN/send`, then
 * `$mdnsent`), "No" sends nothing, and the question comes back the next
 * time the email is opened. It goes out with the identity of the team
 * mailbox or the alias that received the email (`identityForEmail`), and
 * names that address.
 */
export function useReadReceiptRequest(email: EmailDetail): void {
  const { t, lang } = useI18n()
  const confirm = useConfirm()
  const { notify } = useNotify()
  const client = useJmapClient()
  const queryClient = useQueryClient()
  const { accountId, session, mailAddress } = useJmapSession()
  const identities = useIdentities()
  const mailboxes = useMailboxes()
  const askedRef = useRef(false)
  const sentId =
    mailboxes.data === undefined
      ? undefined
      : findMailboxIdByRole(mailboxes.data, 'sent')
  // The identity of the team mailbox or the alias the email reached
  const { identity, receivedAt } = identityForEmail(email, {
    identities: identities.data ?? [],
    mailboxes: mailboxes.data ?? []
  })
  const isReady = sentId !== undefined && identities.data !== undefined

  useEffect(() => {
    if (!isReady || askedRef.current) return
    askedRef.current = true
    if (!asksReadReceipt(email, sentId)) return
    const subject = email.subject ?? ''
    const send = async (): Promise<void> => {
      if (!(MDN_CAPABILITY in session.capabilities)) {
        notify({
          message: t('email.readReceipt.notSupported'),
          severity: 'error'
        })
        return
      }
      if (identity === null) {
        notify({
          message: t('email.readReceipt.noIdentity'),
          severity: 'error'
        })
        return
      }
      const response = await client.call('MDN/send', {
        accountId,
        identityId: identity.id,
        send: {
          receipt: {
            forEmailId: email.id,
            subject: t('email.readReceipt.subject', { subject }),
            textBody: t('email.readReceipt.body', {
              receiver: receivedAt ?? mailAddress,
              time: formatFullDate(new Date().toISOString(), lang),
              subject
            }),
            disposition: {
              actionMode: 'manual-action',
              sendingMode: 'mdn-sent-manually',
              type: 'displayed'
            }
          }
        },
        onSuccessUpdateEmail: { '#receipt': { [`keywords/${MDN_SENT}`]: true } }
      })
      if (!response.sent?.receipt) {
        notify({ message: t('common.errorOccurred'), severity: 'error' })
        return
      }
      // Not asked again, without waiting for push
      queryClient.setQueryData<EmailDetail | null>(
        emailKeys.detail(accountId, email.id),
        current =>
          current
            ? {
                ...current,
                keywords: { ...current.keywords, [MDN_SENT]: true }
              }
            : current
      )
      notify({ message: t('email.readReceipt.sent'), severity: 'success' })
    }
    void confirm({
      title: t('email.readReceipt.title'),
      message: t('email.readReceipt.message'),
      confirmLabel: t('common.yes'),
      cancelLabel: t('common.no'),
      // The messages of a conversation each ask in turn
      queue: true
    })
      .then(isConfirmed => (isConfirmed ? send() : undefined))
      .catch((error: unknown) => {
        console.error(error)
        notify({ message: t('common.errorOccurred'), severity: 'error' })
      })
  }, [
    isReady,
    email,
    sentId,
    identity,
    receivedAt,
    session,
    mailAddress,
    accountId,
    client,
    confirm,
    notify,
    queryClient,
    t,
    lang
  ])
}
