import type { ReactElement } from 'react'

import { SettingsOption } from '@/ds/SettingsOption/SettingsOption'

export interface PreferenceOptionProps {
  /** Label of the switch, e.g. "Enable thread" */
  toggleLabel: string
  description: string
  isChecked: boolean
  isDisabled?: boolean
  onChange: (isChecked: boolean) => void
  /** Under the text, in orange: what the choice made costs */
  warning?: string | null
  'data-testid': string
}

/**
 * An option of Settings > Preferences: the label of its switch, what it
 * does, and the switch (described by the text)
 */
export function PreferenceOption(props: PreferenceOptionProps): ReactElement {
  return <SettingsOption {...props} />
}
