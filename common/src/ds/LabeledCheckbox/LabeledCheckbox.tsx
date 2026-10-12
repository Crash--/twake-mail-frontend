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

const ICON_SIZE = 20
/** twake-mui draws its glyph in 18 px out of 24: the same share of 20 px */
const TWAKE_ICON_PADDING = 2.5

const CHECKBOX_SX = {
  color: 'primary.main',
  // The empty box: MUI's icon
  '& .MuiSvgIcon-root': { fontSize: ICON_SIZE },
  // The checked one: twake-mui's, 24 px by default, which would make the
  // line taller when the box gets checked
  '& svg.twake-icon': {
    width: ICON_SIZE - 2 * TWAKE_ICON_PADDING,
    height: ICON_SIZE - 2 * TWAKE_ICON_PADDING,
    padding: `${TWAKE_ICON_PADDING}px`
  }
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
