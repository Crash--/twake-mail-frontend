// Upstream to twake-ui: yes, the pressed look as an `IconButton` style bound
// to `aria-pressed`, and a `label` giving the tooltip and the accessible name
// (docs/twake-mui-gaps.md).
import { Icon, type IconProps } from '@linagora/twake-icons'
import {
  Box,
  IconButton,
  Tooltip,
  type IconButtonProps
} from '@linagora/twake-mui'
import { forwardRef, type ReactElement } from 'react'

// TODO: remove once the common grid of twake-icons
// (https://github.com/Crash--/twake-ui/pull/20, twake-icons 4.0.0) is merged
// and published: an `Icon` of 24 px will then carry its safe zone.
/**
 * The glyph of a twake-icons icon on the grid of the Figma toolbar icons
 * (Teammail 1.1): drawn within 20 px, centred in a 24 px box by a 2 px safe
 * zone. twake-icons crop their viewBox to the glyph, so at 24 px each one
 * touches the edge of its box.
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
