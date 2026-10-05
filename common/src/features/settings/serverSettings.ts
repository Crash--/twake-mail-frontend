import { queryOptions, useQuery } from '@tanstack/react-query'
import type { JmapClient } from 'jmap-client-ts'
import {
  LINAGORA_CAPABILITIES,
  type KnownSettingKey
} from 'jmap-client-ts/linagora'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

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
  key: KnownSettingKey,
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
  if (!isOffered || query.isError) return { settings: {}, isSettled: true }
  return { settings: query.data ?? null, isSettled: query.data !== undefined }
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
