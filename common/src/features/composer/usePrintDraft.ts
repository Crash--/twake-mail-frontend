import { useCallback } from 'react'

import { formatAddress } from '@common/features/email/addresses'
import { findReferencedCids } from '@common/features/email/emailBody'
import { formatSize } from '@common/features/email/formatSize'
import {
  buildPrintDocument,
  PRINT_BODY_SELECTOR,
  printHtmlDocument
} from '@common/features/email/printDocument'
import { sanitizeEmailHtml } from '@common/features/email/sanitizeEmailHtml'
import { downloadInlineImages } from '@common/features/email/useInlineImageUrls'
import { formatFullDate } from '@common/features/thread/formatListDate'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import type { ComposedMessage } from './composeEmail'
import { toEmailHtml } from './emailHtml'
import type { InlineImageStore } from './InlineImageStore'

/** How long the object URLs of the printed images outlive the print frame */
const PRINT_URLS_LIFETIME_MS = 120_000

/**
 * "Print" of the composer (tmail-flutter `printDraft`, tf#3427): prints the
 * message as it is written, laid out as "Print all" prints an email: the
 * sender (the identity), now, the recipients, the body and the list of the
 * attached files. Its inline images are printed (the ones that are not in
 * the page are downloaded); remote images only when the composer shows them.
 * Says printing started, and says so when it failed.
 */
export function usePrintDraft(
  images: InlineImageStore
): (message: ComposedMessage, allowRemoteContent: boolean) => Promise<void> {
  const { t, lang } = useI18n()
  const { notify } = useNotify()
  const client = useJmapClient()
  const { accountId, session } = useJmapSession()

  return useCallback(
    async (
      message: ComposedMessage,
      allowRemoteContent: boolean
    ): Promise<void> => {
      notify({ message: t('print.inProgress') })
      const created: string[] = []
      try {
        const html = toEmailHtml(message.editorHtml)
        const cids = Array.from(findReferencedCids(html))
        const shown = cids.flatMap(cid => {
          const url = images.urlFor(cid)
          return url === null ? [] : [[cid, url] as const]
        })
        const downloaded = await downloadInlineImages(
          client,
          accountId,
          cids.flatMap(cid => {
            // The images of a quote or a reopened draft, not in the page
            const image = images.get(cid)
            return image?.url === null
              ? [{ cid, blobId: image.blobId, type: image.type }]
              : []
          }),
          new AbortController().signal,
          url => {
            created.push(url)
          }
        )
        const body = sanitizeEmailHtml(html, {
          inlineImageUrls: new Map([...shown, ...downloaded]),
          allowRemoteContent,
          normalizeImageSizes: true,
          styleScope: PRINT_BODY_SELECTOR
        })
        const list = (addresses: ComposedMessage['to'] = []): string =>
          addresses.map(formatAddress).join(', ')
        const files = message.attachments ?? []
        await printHtmlDocument(
          buildPrintDocument({
            lang,
            title: `${t('app.name')} - ${message.subject}`,
            userName: session.username,
            subject: message.subject,
            fromLabel: t('email.from'),
            senderName: message.from.name ?? '',
            senderAddress: message.from.email,
            date: formatFullDate(new Date().toISOString(), lang),
            recipients: [
              { label: t('email.replyTo'), value: list(message.replyTo) },
              { label: t('email.to'), value: list(message.to) },
              { label: t('email.cc'), value: list(message.cc) },
              { label: t('email.bcc'), value: list(message.bcc) }
            ],
            bodyHtml: body.html,
            attachmentsTitle: `${files.length} ${t(files.length > 1 ? 'email.attachments' : 'email.attachment').toLocaleLowerCase(lang)}`,
            attachments: files.map(file => ({
              name: file.name,
              size: formatSize(file.size, lang)
            })),
            allowRemoteContent
          })
        )
      } catch (error: unknown) {
        console.error('[composer] Cannot print', error)
        notify({ message: t('print.failed'), severity: 'error' })
      } finally {
        // The frame is gone after the print dialog, or after its timeout
        setTimeout(() => {
          created.forEach(url => {
            URL.revokeObjectURL(url)
          })
        }, PRINT_URLS_LIFETIME_MS)
      }
    },
    [t, lang, notify, client, accountId, session.username, images]
  )
}
