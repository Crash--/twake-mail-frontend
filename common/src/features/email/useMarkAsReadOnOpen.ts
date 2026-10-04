import type { Email } from 'jmap-client-ts'
import { useEffect, useRef } from 'react'

import { useEmailActions } from '@common/features/emailActions/useEmailActions'

import { hasKeyword, SEEN } from './keywords'

/**
 * Marks an unread email as read when it is opened, once per email: marked
 * unread while open, it stays unread.
 */
export function useMarkAsReadOnOpen(
  email: Pick<Email, 'id' | 'mailboxIds' | 'keywords'>
): void {
  const { run } = useEmailActions()
  const markedEmailId = useRef<string | null>(null)

  useEffect(() => {
    // The ref keeps the effect, run twice in development, from sending two
    // requests, a failed request from being retried in a loop, and an email
    // the user marks unread while reading it from being read again
    if (markedEmailId.current === email.id) return
    markedEmailId.current = email.id
    if (!hasKeyword(email, SEEN)) {
      void run({
        action: 'markAsRead',
        emails: [email],
        mailboxId: null,
        silent: true
      })
    }
  }, [email, run])
}
