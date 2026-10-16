import { useEffect, useState, type ReactElement } from 'react'

import { WithoutTablets } from '@/ds/useScreenSize/useScreenSize'
import { connectSpaceOverlay } from '@linagora/twake-mui'
import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'
import { FullPageLoader } from '@common/components/FullPageLoader'
import { completeConfig } from '@common/config/completeConfig'
import type { AppConfig } from '@common/config/config'
import { peekPendingLoginReturnTo } from '@common/features/auth/oidcAuth'
import { LoadingAnnouncer } from '@common/features/loading/LoadingAnnouncer'
import { reportOverlayRegion } from '@common/features/teamMailboxEmbed/spaceBridge'
import {
  isIntentsCallbackPath,
  isUnderIntentsPath,
  parseIntentPath
} from '@common/features/intents/intentPath'
import { parseTeamMailboxEmbedPath } from '@common/features/teamMailboxEmbed/teamMailboxEmbedPath'
import { findPreferredLanguage } from '@common/i18n/languages'
import { TeamMailboxLoadingScreen } from '@common/layout/TeamMailboxLoadingScreen'

import { App } from './App'
import type { IntentsPage } from './IntentsApp'
import { SsoUnreachableScreen } from './SsoUnreachableScreen'
import type { TeamMailboxEmbed } from './TeamMailboxEmbedApp'

/**
 * The facade of a team mailbox the page is for: its path, or the login
 * callback of a login it started (the callback path is outside its base)
 */
function findTeamMailboxEmbed(config: AppConfig): TeamMailboxEmbed | null {
  const { pathname, href } = window.location
  const target = parseTeamMailboxEmbedPath(pathname)
  if (target !== null) return { target, callbackUrl: null }
  if (config.oidc === null) return null
  if (pathname !== new URL(config.oidc.redirectUri).pathname) return null
  const returnTo = peekPendingLoginReturnTo()
  const pending = returnTo === null ? null : parseTeamMailboxEmbedPath(returnTo)
  return pending === null
    ? null
    : { target: pending, callbackUrl: new URL(href) }
}

/**
 * The intents page the page is for: every path under `/intents`, never the
 * webmail (no other app may frame it). Its login callback is
 * `/intents/callback`, with the intent of the login it started.
 */
function findIntentsPage(): IntentsPage | null {
  const { pathname, search, href } = window.location
  if (!isUnderIntentsPath(pathname)) return null
  if (isIntentsCallbackPath(pathname)) {
    const returnTo = peekPendingLoginReturnTo()
    return {
      intentId: returnTo === null ? null : parseIntentPath(returnTo),
      callbackUrl: new URL(href)
    }
  }
  return {
    intentId: parseIntentPath(`${pathname}${search}`),
    callbackUrl: null
  }
}

export interface AppBootstrapProps {
  config: AppConfig
}

/**
 * Starts the app once the configuration is complete (`completeConfig`),
 * under providers that stay mounted from the first render: the "Loading"
 * live region of the page (and, on the facade of a team mailbox, its
 * loading screen) carries on through the sign-in and the JMAP session into
 * the app instead of starting over.
 */
export function AppBootstrap({ config }: AppBootstrapProps): ReactElement {
  const [queryClient] = useState(makeQueryClient)
  const [lang] = useState(() => findPreferredLanguage(config.defaultLanguage))
  const [embed] = useState(() => findTeamMailboxEmbed(config))
  const [intents] = useState(findIntentsPage)
  // Framed by TwakeSpace, the composer and the dialogs go onto its page
  const [overlay] = useState(() =>
    embed === null ? null : connectSpaceOverlay(reportOverlayRegion)
  )
  const [completed, setCompleted] = useState<AppConfig | null>(null)
  const [failure, setFailure] = useState<
    'sso-unreachable' | 'unexpected' | null
  >(null)
  const [attempt, setAttempt] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    let isCurrent = true
    completeConfig(config)
      .then(result => {
        if (!isCurrent) return
        if (result.ok) setCompleted(result.value)
        else setFailure(result.error)
      })
      .catch(() => {
        // The issuer is still a guess: no sign-in can start from it
        if (isCurrent) setFailure('unexpected')
      })
      .finally(() => {
        if (isCurrent) setIsRetrying(false)
      })
    return () => {
      isCurrent = false
    }
  }, [config, attempt])

  // The error screen stays while the next attempt runs: Retry keeps the focus
  function handleRetry(): void {
    if (isRetrying) return
    setIsRetrying(true)
    setAttempt(previous => previous + 1)
  }

  const app =
    completed === null ? null : (
      <App config={completed} embed={embed} intents={intents} />
    )
  const loading = failure ? (
    <SsoUnreachableScreen reason={failure} onRetry={handleRetry} />
  ) : embed === null ? (
    <FullPageLoader />
  ) : (
    <TeamMailboxLoadingScreen />
  )
  const page = (
    <AppProviders
      lang={lang}
      queryClient={queryClient}
      debug={config.debug}
      overlay={overlay}
    >
      <LoadingAnnouncer>{app ?? loading}</LoadingAnnouncer>
    </AppProviders>
  )
  if (embed === null) return page
  // The facade is a desktop from 600 px: its frame is narrower than the
  // screen of TwakeSpace, where a tablet layout would surprise.
  return <WithoutTablets>{page}</WithoutTablets>
}
