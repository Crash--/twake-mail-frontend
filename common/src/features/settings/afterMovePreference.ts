import { useCallback } from 'react'

import type { ViewTransitionDirection } from '@/ds/ViewTransition/viewTransition'

import { createLocalPreference } from './localPreference'

/**
 * The "After deleting or moving an email" preference (Settings >
 * Preferences, not in tmail-flutter): what the reading view shows once the
 * open email leaves its folder through an action of this view. Back to the
 * list by default, as tmail-flutter; or the next (below) or previous (above)
 * email of the list, the other one when there is none. Kept in this browser.
 */
export type AfterMovePreference = 'list' | 'next' | 'previous'

/** The choices of Settings > Preferences, in their order */
export const AFTER_MOVE_PREFERENCES: readonly AfterMovePreference[] = [
  'list',
  'next',
  'previous'
]

export const DEFAULT_AFTER_MOVE: AfterMovePreference = 'list'

export const AFTER_MOVE_PREFERENCE_STORAGE_KEY =
  'twake-mail.preferences.afterMove'

export function toAfterMovePreference(raw: string | null): AfterMovePreference {
  return raw === 'next' || raw === 'previous' ? raw : DEFAULT_AFTER_MOVE
}

export const afterMovePreference = createLocalPreference<AfterMovePreference>({
  key: AFTER_MOVE_PREFERENCE_STORAGE_KEY,
  parse: toAfterMovePreference,
  serialize: String
})

export interface AfterMovePreferenceApi {
  preference: AfterMovePreference
  setPreference: (preference: AfterMovePreference) => void
}

export function useAfterMovePreference(): AfterMovePreferenceApi {
  const preference = afterMovePreference.useValue()
  const setPreference = useCallback((value: AfterMovePreference) => {
    afterMovePreference.write(value)
  }, [])
  return { preference, setPreference }
}

export interface AfterMoveTarget {
  emailId: string
  direction: ViewTransitionDirection
}

/**
 * The email to open once the open one left its folder, null for the list:
 * the chosen neighbour, else the other one
 */
export function afterMoveTarget(
  preference: AfterMovePreference,
  neighbors: { previousId: string | null; nextId: string | null }
): AfterMoveTarget | null {
  if (preference === 'list') return null
  const next: AfterMoveTarget | null =
    neighbors.nextId === null
      ? null
      : { emailId: neighbors.nextId, direction: 'forward' }
  const previous: AfterMoveTarget | null =
    neighbors.previousId === null
      ? null
      : { emailId: neighbors.previousId, direction: 'backward' }
  return preference === 'next' ? (next ?? previous) : (previous ?? next)
}
