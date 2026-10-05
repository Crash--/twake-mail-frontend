import { useQuery } from '@tanstack/react-query'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'

import type { SentrySetup } from '@common/app/sentry'
import { useAppConfig } from '@common/config/AppConfigProvider'
import type { AppConfig } from '@common/config/config'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import {
  canChangeServerSetting,
  readSentryUserOptIn,
  useServerSettings
} from '@common/features/settings/serverSettings'

import {
  ecosystemSentryQueryOptions,
  isSafeEcosystemDsn,
  type EcosystemSentry
} from './ecosystem'

export interface SentryReportingState {
  /** A valid configuration exists: the preference can be shown */
  isConfigured: boolean
  /** The server keeps the choice of the user and lets them change it */
  canChoose: boolean
  /** What the toggle shows: the choice of the user, else the default */
  isOptedIn: boolean
  /** The reporting is allowed right now, and where to send it */
  setup: SentrySetup | null
}

/**
 * The configuration of the reporting: the environment when it holds one of
 * the `SENTRY_*` keys (even to turn it off), else the ecosystem of the server.
 */
export function resolveSentrySetup(
  config: AppConfig,
  ecosystem: EcosystemSentry | null
): Omit<SentrySetup, 'release'> | null {
  if (config.sentrySource === 'env') {
    return config.sentryDsn === null
      ? null
      : { dsn: config.sentryDsn, environment: config.sentryEnvironment }
  }
  if (
    ecosystem?.enabled !== true ||
    ecosystem.dsn === null ||
    ecosystem.environment === null ||
    !isSafeEcosystemDsn(ecosystem.dsn)
  ) {
    return null
  }
  return { dsn: ecosystem.dsn, environment: ecosystem.environment }
}

/**
 * Whether the user's reports are allowed, from the configuration, the choice
 * stored with the account on the server (`sentry.user-opt-in`) and the
 * default of the ecosystem (`userOptInByDefault`, off when missing). While
 * anything is unknown, and when the server cannot keep the choice, it is
 * off.
 */
export function useSentryReporting(): SentryReportingState {
  const config = useAppConfig()
  const { accountId, session } = useJmapSession()
  const { settings, isRead } = useServerSettings()
  const isEnvOff = config?.sentrySource === 'env' && config.sentryDsn === null
  const ecosystem = useQuery({
    ...ecosystemSentryQueryOptions(accountId, config?.ecosystemUrl ?? ''),
    enabled: config !== null && !isEnvOff
  })

  const off: SentryReportingState = {
    isConfigured: false,
    canChoose: false,
    isOptedIn: false,
    setup: null
  }
  if (config === null || isEnvOff) return off
  const found = resolveSentrySetup(config, ecosystem.data ?? null)
  if (found === null) return off

  const canChoose =
    LINAGORA_CAPABILITIES.settings in session.capabilities &&
    isRead &&
    canChangeServerSetting(session, 'sentry.user-opt-in')
  const choice = settings === null ? null : readSentryUserOptIn(settings)
  // The default is known once the ecosystem answered, or failed
  const isDefaultKnown = !ecosystem.isPending
  const isOptedIn =
    choice ?? (isDefaultKnown && ecosystem.data?.userOptInByDefault === true)
  return {
    isConfigured: true,
    canChoose,
    isOptedIn,
    // Without a server that keeps the choice there is nothing to consent
    // with: nothing is sent
    setup:
      canChoose && isOptedIn ? { ...found, release: config.appVersion } : null
  }
}
