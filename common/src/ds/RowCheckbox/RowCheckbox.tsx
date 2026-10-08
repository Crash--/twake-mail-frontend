// Upstream to twake-ui: no, the look of tmail-flutter. Its row checkbox is a
// 20 px rounded square, light steel grey at rest, primary blue under the
// pointer and once checked, in a 40 px target 4 px from the edge of the row.
import { Icon } from '@linagora/twake-icons'
import { Checkbox } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'

import { CheckboxOff, CheckboxOn } from '@/ds/FlutterIcons/FlutterIcons'

const CHECKBOX_SX = {
  width: 40,
  height: 40,
  ml: '4px',
  p: '10px',
  color: '#AEB7C2',
  // The theme pads its checkbox icons by 3 px: tmail-flutter's box fills
  // its 20 px
  '&& svg.twake-icon': {
    width: 20,
    height: 20,
    padding: 0,
    boxSizing: 'border-box'
  },
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
      // tmail-flutter's own boxes: a rounded square, ticked once checked
      icon={<Icon icon={CheckboxOff} size={20} />}
      checkedIcon={<Icon icon={CheckboxOn} size={20} />}
      sx={CHECKBOX_SX}
      data-testid={testId}
    />
  )
}
