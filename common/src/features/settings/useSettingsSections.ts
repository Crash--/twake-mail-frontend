import { useMemo } from 'react'

import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { availableSettingsSections, type SettingsSection } from './sections'

/** The settings sections the server offers, in order */
export function useSettingsSections(): SettingsSection[] {
  const { session } = useJmapSession()
  return useMemo(() => availableSettingsSections(session), [session])
}
