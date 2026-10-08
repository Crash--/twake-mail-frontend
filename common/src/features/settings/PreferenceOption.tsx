import type { ReactElement } from 'react'

import { SettingsOption } from '@/ds/SettingsOption/SettingsOption'

export interface PreferenceOptionProps {
  title: string
  description: string
  /** Label of the switch, e.g. "Enable thread" */
  toggleLabel: string
  isChecked: boolean
  isDisabled?: boolean
  onChange: (isChecked: boolean) => void
  'data-testid': string
}

/**
 * An option of Settings > Preferences, as tmail-flutter shows it: its
 * title, what it does, and the switch (described by both)
 */
export function PreferenceOption(props: PreferenceOptionProps): ReactElement {
  return <SettingsOption {...props} />
}
