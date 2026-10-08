// Upstream to twake-ui: no, the look of tmail-flutter. Its row checkbox is a
// 20 px rounded square, light steel grey at rest, primary blue under the
// pointer and once checked, in a 40 px target 4 px from the edge of the row.
import { Checkbox } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'

const CHECKBOX_SX = {
  width: 40,
  height: 40,
  ml: '4px',
  p: '10px',
  color: '#AEB7C2',
  '& .MuiSvgIcon-root': { fontSize: 20 },
  '&:hover, .MuiTableRow-root:hover &': { color: 'primary.main' }
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
      sx={CHECKBOX_SX}
      data-testid={testId}
    />
  )
}
