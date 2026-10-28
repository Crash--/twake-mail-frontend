// Upstream to twake-ui: no, twake-mui's `Checkbox` and its label in a
// `FormControlLabel`, both clickable.
import { Checkbox, FormControlLabel } from '@linagora/twake-mui'
import type { ChangeEvent, ReactElement } from 'react'

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
      control={
        <Checkbox
          checked={checked}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onChange(event.target.checked)
          }}
          data-testid={testId}
        />
      }
    />
  )
}
