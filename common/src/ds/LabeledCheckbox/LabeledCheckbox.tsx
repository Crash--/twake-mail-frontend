// Upstream to twake-ui: no, the look of tmail-flutter's checkboxes with a
// label (`CustomIconLabeledCheckbox`, the advanced search): a 20 px rounded
// square in the primary blue, checked or not, and the label in Inter 14
// black. twake-mui's `Checkbox` is grey until checked.
import { Checkbox, FormControlLabel } from '@linagora/twake-mui'
import type { ChangeEvent, ReactElement } from 'react'

import { TMAIL } from '@/ds/TmailColors/tmailColors'

const LABEL_SX = {
  mr: 3,
  ml: '-9px',
  '& .MuiFormControlLabel-label': {
    fontSize: 14,
    color: TMAIL.textBlack,
    letterSpacing: 0
  }
} as const

const CHECKBOX_SX = {
  color: 'primary.main',
  '& .MuiSvgIcon-root': { fontSize: 20 }
} as const

export interface LabeledCheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  'data-testid'?: string
}

/** A checkbox and its label, both clickable */
export function LabeledCheckbox({
  label,
  checked,
  onChange,
  'data-testid': testId
}: LabeledCheckboxProps): ReactElement {
  return (
    <FormControlLabel
      label={label}
      sx={LABEL_SX}
      control={
        <Checkbox
          checked={checked}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onChange(event.target.checked)
          }}
          sx={CHECKBOX_SX}
          data-testid={testId}
        />
      }
    />
  )
}
