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
import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode
} from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

/** Distance to the edges of the screen, in theme spacing units */
const OFFSET = 2

/** Room the button takes at the bottom of the screen, for the content under it */
export const FLOATING_ACTION_INSET = 88

const AlwaysFloatingContext = createContext(false)

/**
 * The screens below show their floating button on a desktop too (a layout
 * without sidebar, where the main action has no other place)
 */
export function AlwaysFloatingAction({
  children
}: {
  children: ReactNode
}): ReactElement {
  return (
    <AlwaysFloatingContext.Provider value>
      {children}
    </AlwaysFloatingContext.Provider>
  )
}

/**
 * The room to keep free at the end of scrolling content: the floating
 * button is there below the desktop size, and on a desktop under
 * `AlwaysFloatingAction`
 */
export function useFloatingActionInset(): number {
  const screenSize = useScreenSize()
  const isAlwaysFloating = useContext(AlwaysFloatingContext)
  return isAlwaysFloating || screenSize !== 'desktop'
    ? FLOATING_ACTION_INSET
    : 0
}

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
