// Upstream to twake-ui: yes, a `Checkbox` whose empty box is `border.main`
// instead of `text.secondary` (docs/twake-mui-gaps.md). The selection
// checkbox of a list row: twake-mui's small Checkbox (a 32 px target), grey
// at rest, primary under the pointer and once checked.
import { Icon } from '@linagora/twake-icons'
import { Checkbox } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'

import { CheckboxOff, CheckboxOn } from '@/ds/FlutterIcons/FlutterIcons'

const CHECKBOX_SX = {
  color: 'border.main',
  '&:hover, .MuiTableRow-root:hover &, &.Mui-checked': {
    color: 'primary.main'
  }
} as const

export interface RowCheckboxProps {
  checked: boolean
  onClick: (event: MouseEvent<HTMLElement>) => void
  /** Accessible name, e.g. "Select <subject>" */
  label: string
  'data-testid'?: string
}

/** The selection checkbox of a list row */
export function RowCheckbox({
  checked,
  onClick,
  label,
  'data-testid': testId
}: RowCheckboxProps): ReactElement {
  return (
    <Checkbox
      checked={checked}
      onClick={onClick}
      slotProps={{ input: { 'aria-label': label } }}
      size="small"
      icon={<Icon icon={CheckboxOff} />}
      checkedIcon={<Icon icon={CheckboxOn} />}
      sx={CHECKBOX_SX}
      data-testid={testId}
    />
  )
}
