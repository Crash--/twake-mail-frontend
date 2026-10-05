import type { Session } from 'jmap-client-ts'

import {
  isLabelCategorizationOn,
  useServerSettings
} from '@common/features/settings/serverSettings'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { AIBOT_CAPABILITY } from '@common/features/scribe/scribe'

/**
 * Whether the account has the AI capability (tmail-flutter
 * `AiCapabilities.aiCapability.isSupported`: read on the account)
 */
export function hasAiCapability(
  session: Pick<Session, 'accounts'>,
  accountId: string
): boolean {
  const account = session.accounts[accountId]
  return (
    account !== undefined && AIBOT_CAPABILITY in account.accountCapabilities
  )
}

export interface AiNeedsActionState {
  /** The "Action required" feature is on */
  isEnabled: boolean
  /** The settings are read (or failed): `isEnabled` will not change by itself */
  isSettled: boolean
}

/**
 * The "Action required" feature (tmail-flutter `isAINeedsActionEnabled`):
 * the server has the AI capability and the user turned the "Label
 * categorisation" preference on. Off while the settings load or fail.
 */
export function useAiNeedsAction(): AiNeedsActionState {
  const { session, accountId } = useJmapSession()
  const { settings, isSettled } = useServerSettings()
  return {
    isEnabled:
      hasAiCapability(session, accountId) &&
      settings !== null &&
      isLabelCategorizationOn(settings),
    isSettled
  }
}

export function useAiNeedsActionEnabled(): boolean {
  return useAiNeedsAction().isEnabled
}
