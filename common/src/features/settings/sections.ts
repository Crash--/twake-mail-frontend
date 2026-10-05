import {
  Filter,
  Globe,
  Help,
  Identities,
  Send,
  Setting,
  type IconProps
} from '@linagora/twake-icons'
import type { Session } from 'jmap-client-ts'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'

import type { TranslationKey } from '@common/i18n/useI18n'

import { canChangeServerSetting } from './serverSettings'

/** Path of the settings, `/settings/<section>` for one of them */
export const SETTINGS_PATH = '/settings'

/**
 * The sections of the settings, in the order of tmail-flutter
 * (`AccountMenuItem`), with the alias of its URLs
 */
export type SettingsSectionId =
  | 'profiles'
  | 'email-rules'
  | 'preferences'
  | 'forwarding'
  | 'language-region'
  | 'keyboard-shortcuts'

export interface SettingsSection {
  id: SettingsSectionId
  icon: IconProps['icon']
  title: TranslationKey
  description: TranslationKey | null
  /** Whether the server offers it; absent: always */
  isAvailable?: (session: Session) => boolean
}

function offers(capability: string): (session: Session) => boolean {
  return session => capability in session.capabilities
}

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id: 'profiles',
    icon: Identities,
    title: 'settings.sections.profiles.title',
    description: 'settings.sections.profiles.description'
  },
  {
    id: 'email-rules',
    icon: Filter,
    title: 'settings.sections.emailRules.title',
    description: 'settings.sections.emailRules.description',
    isAvailable: offers(LINAGORA_CAPABILITIES.filter)
  },
  {
    id: 'preferences',
    icon: Setting,
    title: 'settings.sections.preferences.title',
    description: 'settings.sections.preferences.description'
  },
  {
    id: 'forwarding',
    icon: Send,
    title: 'settings.sections.forwarding.title',
    description: 'settings.sections.forwarding.description',
    isAvailable: offers(LINAGORA_CAPABILITIES.forward)
  },
  {
    id: 'language-region',
    icon: Globe,
    title: 'settings.sections.languageRegion.title',
    description: 'settings.sections.languageRegion.description',
    // Unless the server keeps the language and does not let it change
    isAvailable: session =>
      !(LINAGORA_CAPABILITIES.settings in session.capabilities) ||
      canChangeServerSetting(session, 'language')
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
