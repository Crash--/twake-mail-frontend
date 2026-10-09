// Upstream to twake-ui: yes. A form row with the label on the left and the
// control after it, as tmail-flutter's advanced search
// (`AdvancedSearchInputFormStyle`): a 112 px label column 12 px before the
// control, a 40 px outlined field (1 px #E6E1E5, a 10 px radius, white),
// Inter 14, 12 px between the rows. twake-mui's `TextField` puts the label
// above or inside the field.
import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { TMAIL } from '@/ds/TmailColors/tmailColors'

const ROW_SX = {
  display: 'grid',
  gridTemplateColumns: '112px minmax(0, 1fr)',
  alignItems: 'center',
  columnGap: '12px',
  mb: '12px',
  '& .MuiInputBase-root': {
    width: '100%',
    minHeight: 40,
    boxSizing: 'border-box',
    px: '12px',
    border: `1px solid ${TMAIL.outline}`,
    borderRadius: '10px',
    bgcolor: TMAIL.surface,
    fontSize: 14,
    color: TMAIL.textOnSurface
  },
  '& .MuiInputBase-root.Mui-error': { borderColor: 'error.main' },
  // The outline is the field: no underline
  '& .MuiInputBase-root::before, & .MuiInputBase-root::after': {
    display: 'none'
  },
  '& .MuiInputBase-input, & .MuiSelect-select': {
    fontSize: 14,
    py: 0
  },
  '& .MuiInputBase-input::placeholder': {
    color: 'text.secondary',
    opacity: 1
  }
} as const
const LABEL_SX = { color: TMAIL.textBlack, fontSize: 14 } as const

export interface FormRowProps {
  /** Name of the field, visible; `htmlFor` ties it to the control */
  label: string
  htmlFor: string
  children: ReactNode
}

/** One row: the label, and the control that fills the rest. */
export function FormRow({
  label,
  htmlFor,
  children
}: FormRowProps): ReactElement {
  return (
    <Box sx={ROW_SX}>
      <Typography component="label" htmlFor={htmlFor} sx={LABEL_SX}>
        {label}
      </Typography>
      <Box>{children}</Box>
    </Box>
  )
}
