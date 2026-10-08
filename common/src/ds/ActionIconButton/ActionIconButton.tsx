// Upstream to twake-ui: yes, as a `size="large"` of `IconButton` with a
// `label`. The Twake Mail design draws the actions of the composer (title
// bar and footer) as 40 px round icon buttons around a 24 px icon frame;
// twake-mui sizes `IconButton` from its icon and padding (docs/twake-mui-gaps.md).
import { IconButton, Tooltip, type IconButtonProps } from '@linagora/twake-mui'
import { forwardRef, type ReactElement } from 'react'

export interface ActionIconButtonProps extends Omit<
  IconButtonProps,
  'aria-label' | 'size' | 'sx' | 'title'
> {
  /** Tooltip and accessible name */
  label: string
}

/** Width and height of the button, in px: a 24 px icon and 5 px around */
export const ACTION_ICON_BUTTON_SIZE = 34

/**
 * A 34 px icon button with its tooltip, as tmail-flutter's composer. The icon keeps the size it
 * asks for: 24 px for a Material glyph, 20 px for the `twake-icons` ones,
 * whose drawing fills more of their frame than the Material icons of the
 * design.
 */
export const ActionIconButton = forwardRef<
  HTMLButtonElement,
  ActionIconButtonProps
>(function ActionIconButton({ label, children, ...props }, ref): ReactElement {
  return (
    <Tooltip title={label}>
      <IconButton
        ref={ref}
        aria-label={label}
        {...props}
        sx={{
          width: ACTION_ICON_BUTTON_SIZE,
          height: ACTION_ICON_BUTTON_SIZE,
          p: 0,
          flexShrink: 0,
          // A toggle that is on (Aa showing the formatting): the light blue
          // of the design and tmail-flutter's selected icon button
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
