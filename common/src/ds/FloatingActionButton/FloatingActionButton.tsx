// Upstream to twake-ui: yes, as a placement option of `ExtendableFab`
// (`position="fixed"` at the bottom end, above the safe area). twake-mui
// leaves the position to each app, which then needs `sx`.
import type { IconProps } from '@linagora/twake-icons'
import {
  darken,
  ExtendableFab,
  type SxProps,
  type Theme
} from '@linagora/twake-mui'
import type { ReactElement } from 'react'

/** Distance to the edges of the screen, in theme spacing units */
const OFFSET = 2

/** Room the button takes at the bottom of the screen, for the content under it */
export const FLOATING_ACTION_INSET = 88

const FAB_SX: SxProps<Theme> = theme => ({
  position: 'fixed',
  right: `calc(${theme.spacing(OFFSET)} + env(safe-area-inset-right))`,
  bottom: `calc(${theme.spacing(OFFSET)} + env(safe-area-inset-bottom))`,
  zIndex: theme.zIndex.speedDial,
  // twake-mui writes primary.dark on primary.light: 4.1:1, below the 4.5:1
  // of RGAA 3.2 for its 16 px label (docs/twake-mui-gaps.md); 5.3:1 here (#005ab7)
  color: darken(theme.palette.primary.dark, 0.15)
})

export interface FloatingActionButtonProps {
  /** Text and accessible name, e.g. "New message" */
  label: string
  icon: IconProps['icon']
  onClick?: () => void
  'data-testid'?: string
}

/**
 * The main action of a screen on phones and tablets, floating at the bottom
 * end of the screen: twake-mui's `ExtendableFab`, with its label. It stays
 * under modal panels (drawer, dialogs), which make it inert. Content that
 * scrolls under it keeps `FLOATING_ACTION_INSET` free at its end.
 */
export function FloatingActionButton({
  label,
  icon,
  onClick,
  'data-testid': testId
}: FloatingActionButtonProps): ReactElement {
  return (
    <ExtendableFab
      label={label}
      icon={icon}
      color="primary"
      onClick={onClick}
      data-testid={testId}
      sx={FAB_SX}
    />
  )
}
