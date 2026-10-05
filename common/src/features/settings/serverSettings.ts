import { queryOptions, useQuery } from '@tanstack/react-query'
import type { JmapClient, Session } from 'jmap-client-ts'
import {
  LINAGORA_CAPABILITIES,
  type KnownSettingKey,
  type SettingsCapability
} from 'jmap-client-ts/linagora'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

/**
 * The settings of the account the client reads or writes: the ones the
 * library knows, and the ones of tmail-flutter it does not list yet
 */
export type ServerSettingKey = KnownSettingKey | 'sentry.user-opt-in'

/** The settings of the account kept by the server (Linagora `Settings`) */
export type ServerSettings = Readonly<Record<string, string>>

export type ServerSettingsKey = readonly ['settings', string, 'server']

export const serverSettingsKeys = {
  all: (accountId: string): readonly ['settings', string] => [
    'settings',
    accountId
  ],
  server: (accountId: string): ServerSettingsKey => [
    ...serverSettingsKeys.all(accountId),
    'server'
  ]
}

/** The `Settings` singleton of the account (`Settings/get`) */
export function serverSettingsQueryOptions(
  client: JmapClient,
  accountId: string
): QueryOptionsFor<ServerSettings, ServerSettingsKey> {
  return queryOptions({
    queryKey: serverSettingsKeys.server(accountId),
    queryFn: async ({ signal }) => {
      const response = await client.call(
        'Settings/get',
        { accountId, ids: null },
        { signal }
      )
      return response.list[0]?.settings ?? {}
    },
    staleTime: 5 * 60_000
  })
}

/** A boolean setting: its values are strings, `"true"` is the only true */
export function readBooleanSetting(
  settings: ServerSettings,
  key: ServerSettingKey,
  fallback: boolean
): boolean {
  const value = settings[key]
  return value === undefined ? fallback : value === 'true'
}

export interface ServerSettingsState {
  /** Null while loading; empty when the server has none (no capability) */
  settings: ServerSettings | null
  /** Read, failed, or not offered: what to use is known */
  isSettled: boolean
  /** The settings were read from the server (not failed, not unsupported) */
  isRead: boolean
}

/** The server settings of the account, when the server offers them */
export function useServerSettings(): ServerSettingsState {
  const client = useJmapClient()
  const { accountId, session } = useJmapSession()
  const isOffered = LINAGORA_CAPABILITIES.settings in session.capabilities
  const query = useQuery({
    ...serverSettingsQueryOptions(client, accountId),
    enabled: isOffered
  })
  if (!isOffered || query.isError) {
    return { settings: {}, isSettled: true, isRead: false }
  }
  return {
    settings: query.data ?? null,
    isSettled: query.data !== undefined,
    isRead: query.data !== undefined
  }
}

/**
 * "Always request read receipts" (tmail-flutter `read.receipts.always`,
 * off by default): new messages start with "Request read receipt" on
 */
export function isAlwaysRequestingReadReceipts(
  settings: ServerSettings
): boolean {
  return readBooleanSetting(settings, 'read.receipts.always', false)
}

/**
 * "Display sender-set important flag" (tmail-flutter
 * `display.sender.priority`, on by default and when unreadable)
 */
export function isShowingSenderPriority(settings: ServerSettings): boolean {
  return readBooleanSetting(settings, 'display.sender.priority', true)
}

/** Whether to mark the emails their sender set important */
export function useShowsSenderPriority(): boolean {
  const { settings } = useServerSettings()
  return isShowingSenderPriority(settings ?? {})
}

/**
 * "Error reporting" (tmail-flutter `sentry.user-opt-in`): the choice of the
 * user to send error reports, null while they have not made one
 */
export function readSentryUserOptIn(settings: ServerSettings): boolean | null {
  const value = settings['sentry.user-opt-in']
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

/**
 * Changes one setting of the account (`Settings/set`, a `settings/<key>`
 * patch); false when refused
 */
export async function updateServerSetting(
  client: JmapClient,
  accountId: string,
  key: ServerSettingKey,
  value: string
): Promise<boolean> {
  const response = await client.call('Settings/set', {
    accountId,
    update: { singleton: { [`settings/${key}`]: value } }
  })
  return response.updated !== null && 'singleton' in response.updated
}

/** Whether the server keeps this setting and lets the user change it */
export function canChangeServerSetting(
  session: Session,
  key: ServerSettingKey
): boolean {
  const capability = session.capabilities[LINAGORA_CAPABILITIES.settings] as
    SettingsCapability | undefined
  if (!capability) return false
  return !(capability.readOnlyProperties ?? []).includes(key)
}
