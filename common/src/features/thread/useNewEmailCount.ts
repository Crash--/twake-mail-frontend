import { useEffect, useRef, useState } from 'react'

import { DRAFT, hasKeyword, SEEN } from '@common/features/email/keywords'

import type { EmailListItemData } from './queries'

type CountedEmail = Pick<EmailListItemData, 'receivedAt' | 'keywords'>

/**
 * An email received from someone else: unread and not a draft. A saved
 * draft or the copy of a sent message is a new Email, received "now", but
 * the user wrote it: it is created read.
 */
function isArrival(email: CountedEmail): boolean {
  return !hasKeyword(email, SEEN) && !hasKeyword(email, DRAFT)
}

/**
 * How many times emails more recent than the ones already listed have
 * arrived (by push) since the list was first loaded: what a live region
 * announces. Older emails, appended when scrolling, do not count, nor do
 * the drafts and sent messages the user just saved. Another list
 * (`listKey`: the results of another search) starts again from its first
 * load: its emails are not arrivals.
 */
export function useNewEmailCount(
  emails: readonly CountedEmail[],
  isLoaded: boolean,
  listKey: string
): number {
  const [count, setCount] = useState(0)
  // ISO 8601 dates in UTC compare as strings; null until loaded
  const newestRef = useRef<string | null>(null)
  const listKeyRef = useRef(listKey)

  useEffect(() => {
    if (listKeyRef.current !== listKey) {
      listKeyRef.current = listKey
      newestRef.current = null
    }
    if (!isLoaded) return
    const newest = emails.reduce(
      (latest, email) =>
        email.receivedAt > latest ? email.receivedAt : latest,
      ''
    )
    const previous = newestRef.current
    newestRef.current = newest > (previous ?? '') ? newest : previous
    if (previous === null) return
    const hasArrival = emails.some(
      email => email.receivedAt > previous && isArrival(email)
    )
    if (hasArrival) {
      setCount(value => value + 1)
    }
  }, [emails, isLoaded, listKey])

  return count
}
