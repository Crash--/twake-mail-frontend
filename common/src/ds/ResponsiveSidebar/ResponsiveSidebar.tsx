// Upstream to twake-ui: yes, as a `variant` of `Sidebar` (permanent column
// or modal drawer). twake-mui's `Sidebar` becomes a bottom tab bar below
// `lg`, which suits a few destinations, not a folder tree.
import { Sidebar } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { NavigationDrawer } from '@/ds/NavigationDrawer/NavigationDrawer'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

/**
 * Width of the sidebar column on a desktop, in px: twake-mui's own (and the
 * Figma one); the only place to change it
 */
export const SIDEBAR_WIDTH = 236

export interface ResponsiveSidebarProps {
  /** Whether the drawer is open, below the desktop size */
  open: boolean
  onClose: () => void
  /** Accessible name of the drawer */
  label: string
  closeLabel: string
  /** Top of the drawer: logo, app switcher (the sidebar has none) */
  drawerHeader?: ReactNode
  children: ReactNode
  'data-testid'?: string
  drawerTestId?: string
  closeButtonTestId?: string
}

/**
 * The navigation column of the app: twake-mui's `Sidebar` on a desktop
 * (1200 px and more), a `NavigationDrawer` opened on demand on smaller
 * screens. The app opens it with a button of its top bar and closes it
 * when the user goes somewhere.
 */
export function ResponsiveSidebar({
  open,
  onClose,
  label,
  closeLabel,
  drawerHeader,
  children,
  'data-testid': testId,
  drawerTestId,
  closeButtonTestId
}: ResponsiveSidebarProps): ReactElement {
  const screenSize = useScreenSize()

  if (screenSize === 'desktop') {
    return (
      <Sidebar data-testid={testId} sx={{ width: SIDEBAR_WIDTH }}>
        {children}
      </Sidebar>
    )
  }
  return (
    <NavigationDrawer
      open={open}
      onClose={onClose}
      label={label}
      closeLabel={closeLabel}
      header={drawerHeader}
      data-testid={drawerTestId}
      closeButtonTestId={closeButtonTestId}
    >
      {children}
    </NavigationDrawer>
  )
}
