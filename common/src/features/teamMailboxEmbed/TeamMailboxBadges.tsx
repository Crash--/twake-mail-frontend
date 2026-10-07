import type { Badge } from '@linagora/twake-embed'
import { useEffect, useMemo, useRef } from 'react'

import { useMailboxes } from '@common/features/mailbox/useMailboxes'

import { findTeamMailboxBadges } from './teamMailbox'

export interface TeamMailboxBadgesProps {
  /** Sends TwakeSpace the badges of every team mailbox, each time they change */
  reportBadges: (badges: readonly Badge[]) => void
}

/**
 * Tells TwakeSpace the unread emails of the Inbox of each team mailbox of the
 * user, for the badges of its tabs and spaces: once the folders are loaded,
 * then each time push or the user changes one of these counts. Nothing while
 * they load or when they fail to.
 */
export function TeamMailboxBadges({
  reportBadges
}: TeamMailboxBadgesProps): null {
  const { data } = useMailboxes()
  const badges = useMemo(
    () => (data === undefined ? null : findTeamMailboxBadges(data)),
    [data]
  )

  // Any change of a folder (Sent, a total) gives new data: only a change of
  // the counts is reported again
  const lastReport = useRef<string | null>(null)
  useEffect(() => {
    if (badges === null) return
    const report = JSON.stringify(badges)
    if (report === lastReport.current) return
    lastReport.current = report
    reportBadges(badges)
  }, [badges, reportBadges])

  return null
}
