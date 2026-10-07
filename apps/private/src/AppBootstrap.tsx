import { useEffect, useState, type ReactElement } from 'react'

import { AlwaysFloatingAction } from '@/ds/FloatingActionButton/FloatingActionButton'
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
import { parseTeamMailboxEmbedPath } from '@common/features/teamMailboxEmbed/teamMailboxEmbedPath'
import { findPreferredLanguage } from '@common/i18n/languages'
import { TeamMailboxLoadingScreen } from '@common/layout/TeamMailboxLoadingScreen'

import { App } from './App'
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

export interface AppBootstrapProps {
  config: AppConfig
}

/**
 * Starts the app once the configuration is complete (`completeConfig`),
 * under providers that stay mounted from the first render: the loading
 * screen of the facade of a team mailbox and its "Loading" live region
 * carry on into the app instead of starting over.
 */
export function AppBootstrap({ config }: AppBootstrapProps): ReactElement {
  const [queryClient] = useState(makeQueryClient)
  const [lang] = useState(() => findPreferredLanguage(config.defaultLanguage))
  const [embed] = useState(() => findTeamMailboxEmbed(config))
  // Framed by TwakeSpace, the composer and the dialogs go onto its page
  const [overlay] = useState(() =>
    embed === null ? null : connectSpaceOverlay(reportOverlayRegion)
  )
  const [completed, setCompleted] = useState<AppConfig | null>(null)

  useEffect(() => {
    let isCurrent = true
    completeConfig(config)
      .then(result => {
        if (isCurrent) setCompleted(result)
      })
      .catch(() => {
        if (isCurrent) setCompleted(config)
      })
    return () => {
      isCurrent = false
    }
  }, [config])

  const app =
    completed === null ? null : <App config={completed} embed={embed} />
  const page = (
    <AppProviders
      lang={lang}
      queryClient={queryClient}
      debug={config.debug}
      overlay={overlay}
    >
      {embed === null ? (
        (app ?? <FullPageLoader />)
      ) : (
        <LoadingAnnouncer>
          {app ?? <TeamMailboxLoadingScreen />}
        </LoadingAnnouncer>
      )}
    </AppProviders>
  )
  if (embed === null) return page
  // The facade is a desktop from 600 px: its frame is narrower than the
  // screen of TwakeSpace, where a tablet layout would surprise. Its "New
  // message" button floats at every size: the toasts keep above it.
  return (
    <WithoutTablets>
      <AlwaysFloatingAction>{page}</AlwaysFloatingAction>
    </WithoutTablets>
  )
}
