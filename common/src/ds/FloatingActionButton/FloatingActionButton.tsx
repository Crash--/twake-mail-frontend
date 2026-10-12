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

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

/** Distance to the edges of the screen, in theme spacing units */
const OFFSET = 2

/** Room the button takes at the bottom of the screen, for the content under it */
export const FLOATING_ACTION_INSET = 88

/**
 * The room to keep free at the end of scrolling content: the floating
 * button is there below the desktop size
 */
export function useFloatingActionInset(): number {
  return useScreenSize() === 'desktop' ? 0 : FLOATING_ACTION_INSET
}

// tmail-flutter's "Compose" button (`ComposeFloatingButton`): a 60 px blue
// (#208BFF) pill, a 28 px white icon and a white Medium 16 label
const FAB_SX: SxProps<Theme> = theme => ({
  position: 'fixed',
  right: `calc(${theme.spacing(OFFSET)} + env(safe-area-inset-right))`,
  bottom: `calc(${theme.spacing(OFFSET)} + env(safe-area-inset-bottom))`,
  zIndex: theme.zIndex.speedDial,
  height: 60,
  minWidth: 154,
  pl: '20px',
  pr: '24px',
  gap: '12px',
  borderRadius: '30px',
  bgcolor: '#208BFF',
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: 500,
  textTransform: 'none',
  boxShadow: 'none',
  '&:hover': { bgcolor: darken('#208BFF', 0.1), boxShadow: 'none' },
  '& svg': { width: 28, height: 28 },
  '& .MuiFab-label, & > span': { gap: '12px' }
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
