import type { ReactElement, ReactNode } from 'react'
import { Navigate } from 'react-router'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

import {
  SETTINGS_PATH,
  settingsSectionPath,
  type SettingsSection,
  type SettingsSectionId
} from './sections'
import { SettingsSectionList } from './SettingsSectionList'
import { useSettingsSections } from './useSettingsSections'

/**
 * `/settings`: the list of the sections below the desktop size; on a
 * desktop, whose sidebar lists them, the first one (tmail-flutter opens
 * Profiles).
 */
export function SettingsHome(): ReactElement {
  const isDesktop = useScreenSize() === 'desktop'
  const [first] = useSettingsSections()
  if (isDesktop && first) {
    return <Navigate to={settingsSectionPath(first.id)} replace />
  }
  return <SettingsSectionList />
}

export interface SettingsSectionRouteProps {
  id: SettingsSectionId
  children: (section: SettingsSection) => ReactNode
}

/** A section, or back to `/settings` when the server does not offer it */
export function SettingsSectionRoute({
  id,
  children
}: SettingsSectionRouteProps): ReactElement {
  const section = useSettingsSections().find(candidate => candidate.id === id)
  if (!section) return <Navigate to={SETTINGS_PATH} replace />
  return <>{children(section)}</>
}
