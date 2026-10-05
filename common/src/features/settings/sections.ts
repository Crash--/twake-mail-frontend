import { Help, Setting, type IconProps } from '@linagora/twake-icons'
import type { Session } from 'jmap-client-ts'

import type { TranslationKey } from '@common/i18n/useI18n'

/** Path of the settings, `/settings/<section>` for one of them */
export const SETTINGS_PATH = '/settings'

/**
 * The sections of the settings, in the order of tmail-flutter
 * (`AccountMenuItem`), with the alias of its URLs
 */
export type SettingsSectionId =
  'profiles' | 'preferences' | 'keyboard-shortcuts'

export interface SettingsSection {
  id: SettingsSectionId
  icon: IconProps['icon']
  title: TranslationKey
  description: TranslationKey | null
  /** Whether the server offers it; absent: always */
  isAvailable?: (session: Session) => boolean
}

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id: 'preferences',
    icon: Setting,
    title: 'settings.sections.preferences.title',
    description: 'settings.sections.preferences.description'
  },
  {
    id: 'keyboard-shortcuts',
    icon: Help,
    title: 'settings.sections.keyboardShortcuts.title',
    description: 'settings.sections.keyboardShortcuts.description'
  }
]

/** The sections the server of this session offers, in order */
export function availableSettingsSections(session: Session): SettingsSection[] {
  return SETTINGS_SECTIONS.filter(
    section => section.isAvailable?.(session) ?? true
  )
}

export function settingsSectionPath(id: SettingsSectionId): string {
  return `${SETTINGS_PATH}/${id}`
}
