// Upstream to twake-ui: yes. A form row with the label on the left and the
// control after it (Figma "Search advance": label column, icon, a line under
// the control). twake-mui's `TextField` puts the label above or inside the
// field, and has no icon slot.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const ROW_SX = {
  display: 'grid',
  gridTemplateColumns: '112px 24px minmax(0, 1fr)',
  alignItems: 'end',
  columnGap: 2,
  minHeight: 56,
  '& .MuiInputBase-root': { width: '100%' },
  '& .MuiInputBase-input, & .MuiSelect-select': {
    fontSize: 14,
    py: 0.5
  },
  '& .MuiInputBase-input::placeholder': {
    color: 'text.secondary',
    opacity: 1
  }
} as const
const LABEL_SX = { color: 'text.primary', pb: 1 } as const
const ICON_SX = { color: 'text.secondary', pb: 1, display: 'flex' } as const

export interface FormRowProps {
  /** Name of the field, visible; `htmlFor` ties it to the control */
  label: string
  htmlFor: string
  /** Decorative icon before the control */
  icon?: IconProps['icon']
  children: ReactNode
}

/** One row: the label, an icon and the control that fills the rest. */
export function FormRow({
  label,
  htmlFor,
  icon,
  children
}: FormRowProps): ReactElement {
  return (
    <Box sx={ROW_SX}>
      <Typography
        component="label"
        htmlFor={htmlFor}
        variant="body2"
        sx={LABEL_SX}
      >
        {label}
      </Typography>
      <Box sx={ICON_SX} aria-hidden="true">
        {icon === undefined ? null : <Icon icon={icon} />}
      </Box>
      <Box>{children}</Box>
    </Box>
  )
}
