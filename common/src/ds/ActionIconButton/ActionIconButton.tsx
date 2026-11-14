// Upstream to twake-ui: yes, the pressed look as an `IconButton` style bound
// to `aria-pressed`, and a `label` giving the tooltip and the accessible name
// (docs/twake-mui-gaps.md).
import {
  Box,
  IconButton,
  Tooltip,
  type IconButtonProps
} from '@linagora/twake-mui'
import { forwardRef, type ReactElement } from 'react'

import { Icon, type IconProps } from '@/ds/Icon/Icon'

/**
 * A twake-icons icon at the size of the Figma toolbar icons (Teammail 1.1):
 * 20 px, centred in a 24 px box. twake-icons draw edge to edge and leave the
 * size to the app.
 */
export function ActionIcon({ icon }: Pick<IconProps, 'icon'>): ReactElement {
  return (
    <Box component="span" aria-hidden="true" sx={{ display: 'flex', p: '2px' }}>
      <Icon icon={icon} size={20} />
    </Box>
  )
}

export interface ActionIconButtonProps extends Omit<
  IconButtonProps,
  'aria-label' | 'size' | 'sx' | 'title'
> {
  /** Tooltip and accessible name */
  label: string
}

/**
 * A twake-mui small `IconButton` with its tooltip: 40 px around a 24 px
 * icon (an `ActionIcon`). A toggle that is on (`aria-pressed`) is drawn
 * light blue.
 */
export const ActionIconButton = forwardRef<
  HTMLButtonElement,
  ActionIconButtonProps
>(function ActionIconButton({ label, children, ...props }, ref): ReactElement {
  return (
    <Tooltip title={label}>
      <IconButton
        ref={ref}
        size="small"
        aria-label={label}
        {...props}
        sx={{
          flexShrink: 0,
          '&[aria-pressed="true"]': {
            bgcolor: 'primary.light',
            color: 'primary.dark'
          }
        }}
      >
        {children}
      </IconButton>
    </Tooltip>
  )
})
