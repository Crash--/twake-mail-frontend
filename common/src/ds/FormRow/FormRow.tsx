// Upstream to twake-ui: yes. A form row with the label on the left and the
// control after it, as the Figma advanced search: a 112 px label column
// before the control, the field as twake-mui draws it. twake-mui's
// `TextField` puts the label above or inside the field.
import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const ROW_SX = {
  display: 'grid',
  gridTemplateColumns: '112px minmax(0, 1fr)',
  alignItems: 'center',
  columnGap: 1.5,
  mb: 1.5
} as const

export interface FormRowProps {
  /** Name of the field, visible; `htmlFor` ties it to the control */
  label: string
  /** The input it names; without one the label is a plain text */
  htmlFor?: string
  /** Of the label, for a control named by `aria-labelledby` (a listbox) */
  id?: string
  children: ReactNode
}

/** One row: the label, and the control that fills the rest. */
export function FormRow({
  label,
  htmlFor,
  id,
  children
}: FormRowProps): ReactElement {
  return (
    <Box sx={ROW_SX}>
      <Typography
        component={htmlFor === undefined ? 'span' : 'label'}
        htmlFor={htmlFor}
        id={id}
        variant="body2"
      >
        {label}
      </Typography>
      <Box>{children}</Box>
    </Box>
  )
}
