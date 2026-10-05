import { useCallback } from 'react'

import { formatFullDate } from '@common/features/thread/formatListDate'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { formatAddress } from './addresses'
import {
  findReferencedCids,
  joinHtmlValues,
  renderBodyParts
} from './emailBody'
import { normalizeCid } from './sanitizeEmailHtml'
import { formatSize } from './formatSize'
import { buildPrintDocument, printHtmlDocument } from './printDocument'
import type { EmailDetail } from './queries'
import { isTrustedSender } from './trustedSenders'
import {
  downloadInlineImages,
  findInlineImageParts
} from './useInlineImageUrls'

/**
 * "Print all" of an open email (tmail-flutter `printAll`): says printing
 * started, then prints the email with its headers, body and list of
 * attachments. Remote content is printed for trusted senders only; the
 * quoted history is printed unfolded. Says so when printing failed.
 */
export function usePrintEmail(): (email: EmailDetail) => Promise<void> {
  const { t, lang } = useI18n()
  const { notify } = useNotify()
  const client = useJmapClient()
  const { accountId, session } = useJmapSession()

  return useCallback(
    async (email: EmailDetail): Promise<void> => {
      notify({ message: t('print.inProgress') })
      const created: string[] = []
      try {
        const sender = email.from?.[0] ?? null
        const html = joinHtmlValues(email.htmlBody, email.bodyValues)
        const cids = findReferencedCids(html)
        const urls = await downloadInlineImages(
          client,
          accountId,
          findInlineImageParts(email.attachments, cids),
          new AbortController().signal,
          url => {
            created.push(url)
          }
        )
        const allowRemoteContent =
          sender !== null && isTrustedSender(sender.email)
        const body = renderBodyParts(email.htmlBody, email.bodyValues, {
          inlineImageUrls: urls,
          allowRemoteContent,
          normalizeImageSizes: true
        })
        const files = email.attachments.filter(
          part => !part.cid || !cids.has(normalizeCid(part.cid))
        )
        const list = (addresses: EmailDetail['to']): string =>
          (addresses ?? []).map(formatAddress).join(', ')
        const subject = email.subject ?? ''
        await printHtmlDocument(
          buildPrintDocument({
            lang,
            title: `${t('app.name')} - ${subject}`,
            userName: session.username,
            subject,
            fromLabel: t('email.from'),
            senderName: sender?.name ?? '',
            senderAddress: sender?.email ?? '',
            date: formatFullDate(email.receivedAt, lang),
            recipients: [
              { label: t('email.replyTo'), value: list(email.replyTo ?? null) },
              { label: t('email.to'), value: list(email.to) },
              { label: t('email.cc'), value: list(email.cc) },
              { label: t('email.bcc'), value: list(email.bcc) }
            ],
            bodyHtml: body.html,
            attachmentsTitle: `${files.length} ${t(files.length > 1 ? 'email.attachments' : 'email.attachment').toLocaleLowerCase(lang)}`,
            attachments: files.map(part => ({
              name: part.name ?? part.blobId ?? '',
              size: formatSize(part.size, lang)
            })),
            allowRemoteContent
          })
        )
      } catch (error: unknown) {
        console.error('[email] Cannot print', error)
        notify({ message: t('print.failed'), severity: 'error' })
      } finally {
        // The frame is gone after the print dialog, or after its timeout
        setTimeout(() => {
          created.forEach(url => {
            URL.revokeObjectURL(url)
          })
        }, 120_000)
      }
    },
    [t, lang, notify, client, accountId, session.username]
  )
}
