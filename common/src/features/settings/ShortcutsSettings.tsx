import type { ReactElement } from 'react'

import { ShortcutsPanel } from '@common/features/shortcuts/ShortcutsPanel'
import { useI18n } from '@common/i18n/useI18n'

import type { SettingsSection } from './sections'
import { SettingsSectionLayout } from './SettingsSectionLayout'

export interface ShortcutsSettingsProps {
  section: SettingsSection
}

/**
 * Settings > Keyboard shortcuts: the list, and the switch turning them off,
 * under what single-key shortcuts do (the Figma's page description)
 */
export function ShortcutsSettings({
  section
}: ShortcutsSettingsProps): ReactElement {
  const { t } = useI18n()
  return (
    <SettingsSectionLayout
      section={section}
      description={t('shortcuts.description')}
    >
      <ShortcutsPanel labelledBy={`settings-${section.id}-title`} />
    </SettingsSectionLayout>
  )
}
