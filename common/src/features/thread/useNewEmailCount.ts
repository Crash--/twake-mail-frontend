import { useEffect, useRef, useState } from 'react'

import type { EmailListItemData } from './queries'

/**
 * How many times emails more recent than the ones already listed have
 * arrived (by push) since the list was first loaded: what a live region
 * announces. Older emails, appended when scrolling, do not count.
 */
export function useNewEmailCount(
  emails: readonly Pick<EmailListItemData, 'receivedAt'>[],
  isLoaded: boolean
): number {
  const [count, setCount] = useState(0)
  // ISO 8601 dates in UTC compare as strings; null until loaded
  const newestRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    const newest = emails.reduce(
      (latest, email) =>
        email.receivedAt > latest ? email.receivedAt : latest,
      ''
    )
    const previous = newestRef.current
    newestRef.current = newest > (previous ?? '') ? newest : previous
    if (previous !== null && newest > previous) {
      setCount(value => value + 1)
    }
  }, [emails, isLoaded])

  return count
}
