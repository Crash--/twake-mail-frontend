import { useEffect, type ReactElement } from 'react'

import { sentryLifecycle, stopSentryReporting } from '@common/app/sentry'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { makeSentryUserId } from './sentryUserId'
import { useSentryReporting } from './useSentryReporting'

/**
 * Starts and stops the error reporting as the account allows it, without
 * reloading: on when the user opted in (or the default of the server says
 * so) and a configuration exists, off as soon as they opt out, and when the
 * session ends or the account changes.
 */
export function SentryReportingSync(): ReactElement | null {
  const { accountId } = useJmapSession()
  const { setup } = useSentryReporting()
  const dsn = setup?.dsn
  const environment = setup?.environment
  const release = setup?.release

  useEffect(() => {
    if (dsn === undefined || release === undefined) {
      stopSentryReporting()
      return undefined
    }
    let isCurrent = true
    makeSentryUserId(accountId)
      .then(userId => {
        if (!isCurrent) return undefined
        return sentryLifecycle.apply({
          setup: { dsn, environment: environment ?? null, release },
          userId
        })
      })
      .catch((error: unknown) => {
        console.warn('[sentry] Cannot update the reporting', error)
      })
    return () => {
      isCurrent = false
      stopSentryReporting()
    }
  }, [accountId, dsn, environment, release])

  return null
}
