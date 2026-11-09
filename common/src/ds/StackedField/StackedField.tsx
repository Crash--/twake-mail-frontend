// Upstream to twake-ui: yes, as a `TextField` variant. The field of the
// Figma dialogs: its label above it, 8 px apart, in body2, and the field
// without a floating label. twake-mui's `TextField` draws the label inside
// the outline.
import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const FIELD_SX = { display: 'flex', flexDirection: 'column', gap: 1 } as const

export interface StackedFieldProps {
  /** Name of the field, visible; `htmlFor` ties it to the control */
  label: string
  /** Id of the input it names */
  htmlFor: string
  /** Of the label, for a control named by `aria-labelledby` (a select) */
  id?: string
  className?: string
  children: ReactNode
}

/** A label, and under it the control it names */
export function StackedField({
  label,
  htmlFor,
  id,
  className,
  children
}: StackedFieldProps): ReactElement {
  return (
    <Box sx={FIELD_SX} className={className}>
      <Typography
        component="label"
        htmlFor={htmlFor}
        id={id}
        variant="body2"
        color="textPrimary"
      >
        {label}
      </Typography>
      {children}
    </Box>
  )
}
