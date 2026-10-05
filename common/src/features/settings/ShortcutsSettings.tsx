import type { ReactElement } from 'react'

import { ShortcutsPanel } from '@common/features/shortcuts/ShortcutsPanel'

import type { SettingsSection } from './sections'
import { SettingsSectionLayout } from './SettingsSectionLayout'

export interface ShortcutsSettingsProps {
  section: SettingsSection
}

/** Settings > Keyboard shortcuts: the list, and the switch turning them off */
export function ShortcutsSettings({
  section
}: ShortcutsSettingsProps): ReactElement {
  return (
    <SettingsSectionLayout section={section}>
      <ShortcutsPanel labelledBy={`settings-${section.id}-title`} />
    </SettingsSectionLayout>
  )
}
