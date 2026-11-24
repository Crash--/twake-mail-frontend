import { useCallback } from 'react'

import { createLocalPreference } from './localPreference'

/**
 * The "Split view" preference (Settings > Preferences, not in
 * tmail-flutter): on a computer, the email list stays beside the open
 * email, as on a large tablet, instead of the email replacing it. Off by
 * default, kept in this browser.
 */
export const SPLIT_VIEW_PREFERENCE_STORAGE_KEY =
  'twake-mail.preferences.splitView'

export const splitViewPreference = createLocalPreference<boolean>({
  key: SPLIT_VIEW_PREFERENCE_STORAGE_KEY,
  parse: raw => raw === 'true',
  serialize: String
})

export interface SplitViewPreference {
  isEnabled: boolean
  setEnabled: (isEnabled: boolean) => void
}

export function useSplitViewPreference(): SplitViewPreference {
  const isEnabled = splitViewPreference.useValue()
  const setEnabled = useCallback((value: boolean) => {
    splitViewPreference.write(value)
  }, [])
  return { isEnabled, setEnabled }
}
