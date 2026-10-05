import { useCallback } from 'react'

import { useComposer } from '@common/features/composer/ComposerProvider'
import { useConfirm } from '@common/features/confirm/ConfirmProvider'
import { useI18n } from '@common/i18n/useI18n'

import { formatAddressName } from './addresses'
import { LIST_UNSUBSCRIBE_HEADER, type EmailDetail } from './queries'
import { isUnsubscribed, pickUnsubscribeMethod } from './unsubscribe'
import { useMarkUnsubscribed } from './useMarkUnsubscribed'

export interface Unsubscribe {
  /**
   * Whether the email offers to unsubscribe: a link in its
   * `List-Unsubscribe` header, and not unsubscribed yet
   */
  canUnsubscribe: (email: EmailDetail) => boolean
  /**
   * Asks first, then opens the link of the sender (a new tab, never
   * fetched by the app) or a message to its `mailto:` address in the
   * composer; the email gets the `$unsubscribe` keyword once the link was
   * opened, or the message sent.
   */
  unsubscribe: (email: EmailDetail, mailboxId: string | null) => Promise<void>
}

/** The "Unsubscribe" action of an open email (tmail-flutter) */
export function useUnsubscribe(): Unsubscribe {
  const { t } = useI18n()
  const confirm = useConfirm()
  const { openComposer } = useComposer()
  const markUnsubscribed = useMarkUnsubscribed()

  const canUnsubscribe = useCallback(
    (email: EmailDetail): boolean =>
      !isUnsubscribed(email) &&
      pickUnsubscribeMethod(email[LIST_UNSUBSCRIBE_HEADER]) !== null,
    []
  )

  const unsubscribe = useCallback(
    async (email: EmailDetail, mailboxId: string | null): Promise<void> => {
      const method = pickUnsubscribeMethod(email[LIST_UNSUBSCRIBE_HEADER])
      if (method === null) return
      const sender = email.from?.[0]
      const confirmed = await confirm({
        title: t('unsubscribe.title'),
        message: t('unsubscribe.message', {
          senderName: sender ? formatAddressName(sender) : ''
        }),
        confirmLabel: t('unsubscribe.action')
      })
      if (!confirmed) return
      if (method.kind === 'mailto') {
        openComposer({ mailto: method.mailto, unsubscribeEmailId: email.id })
        return
      }
      // The link of the sender is the user's to follow, in its own tab: the
      // app never fetches it (one-click POST, RFC 8058, would need the
      // Content-Security-Policy to allow any origin)
      window.open(method.url, '_blank', 'noopener,noreferrer')
      await markUnsubscribed(email.id, mailboxId)
    },
    [confirm, t, openComposer, markUnsubscribed]
  )

  return { canUnsubscribe, unsubscribe }
}
