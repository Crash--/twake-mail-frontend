import type { Email } from 'jmap-client-ts'
import { useEffect, useRef } from 'react'

import { hasKeyword, SEEN } from './keywords'
import { useSetKeyword } from './useSetKeyword'

/**
 * Marks an unread email as read when it is opened, once per email.
 */
export function useMarkAsReadOnOpen(
  email: Pick<Email, 'id' | 'mailboxIds' | 'keywords'>
): void {
  const { mutate: setKeyword } = useSetKeyword()
  const markedEmailId = useRef<string | null>(null)

  useEffect(() => {
    // The ref keeps the effect, run twice in development, from sending two
    // requests, and a failed request from being retried in a loop
    if (markedEmailId.current === email.id || hasKeyword(email, SEEN)) return
    markedEmailId.current = email.id
    setKeyword({ email, keyword: SEEN, isSet: true })
  }, [email, setKeyword])
}
