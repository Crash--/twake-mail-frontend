// Upstream to twake-ui: yes, as the narrow-screen variant of `Sidebar`.
// Below `lg`, twake-mui turns `Sidebar` into a bottom bar of a few `Nav`
// tabs (Cozy apps); a folder tree does not fit in one. Every Twake app with
// a long navigation (Calendar, Mail) rebuilds a modal drawer instead, and
// `Nav*` would render as bottom tabs inside it (see docs/twake-mui-gaps.md).
import { Icon } from '@linagora/twake-icons'
import {
  Box,
  Drawer,
  IconButton,
  ThemeProvider,
  Tooltip,
  type Theme
} from '@linagora/twake-mui'
import { useId, type ReactElement, type ReactNode } from 'react'

import { Cross } from '@/ds/FlutterIcons/FlutterIcons'
import { TOUCH_MEDIA, TOUCH_TARGET_SIZE } from '@/ds/TouchTargets/TouchTargets'

/** tmail-flutter `ResponsiveUtils.mobileLeftMenuSize` */
const DRAWER_WIDTH = 339
/** Room left on the side to see the page and tap outside */
const DRAWER_GAP = 40

const NEVER = '@media not all'
const ALWAYS = '@media all'

/**
 * The theme with its wide-screen breakpoints whatever the viewport: inside
 * the drawer, twake-mui renders its desktop variant of `Nav`, `NavItem`,
 * `NavLink`, `NavIcon` and `NavText` (a vertical list) instead of the bottom
 * tabs it switches to below `lg`.
 */
function wideScreenTheme(theme: Theme): Theme {
  return {
    ...theme,
    breakpoints: {
      ...theme.breakpoints,
      up: () => ALWAYS,
      down: () => NEVER,
      between: () => NEVER,
      only: () => NEVER,
      not: () => NEVER
    }
  }
}

const PAPER_SX = {
  width: DRAWER_WIDTH,
  maxWidth: `calc(100% - ${DRAWER_GAP}px)`,
  // White, as tmail-flutter's drawer
  backgroundColor: 'background.paper',
  // Rows and buttons of the drawer are touch targets (WCAG 2.5.5)
  [TOUCH_MEDIA]: {
    '& .MuiListItem-root': { height: TOUCH_TARGET_SIZE }
  }
} as const

export interface NavigationDrawerProps {
  open: boolean
  /** Escape, a tap outside, the close button */
  onClose: () => void
  /** Accessible name of the drawer, e.g. "Navigation" */
  label: string
  /** Name and tooltip of the close button */
  closeLabel: string
  /** Start of the drawer header, before the close button: logo, app switcher */
  header?: ReactNode
  children: ReactNode
  'data-testid'?: string
  closeButtonTestId?: string
}

/**
 * The navigation of a narrow screen: a modal panel sliding from the start
 * edge. While it is open the focus stays inside (Tab cycles through it),
 * the page behind is inert; Escape, a tap outside or the close button close
 * it, and the focus goes back to the button that opened it. Its content is
 * not rendered while it is closed, so nothing hidden stays focusable.
 */
export function NavigationDrawer({
  open,
  onClose,
  label,
  closeLabel,
  header,
  children,
  'data-testid': testId,
  closeButtonTestId
}: NavigationDrawerProps): ReactElement {
  const labelId = useId()

  return (
    <Drawer
      variant="temporary"
      anchor="left"
      open={open}
      onClose={onClose}
      // twake-mui only lifts the focus trap of `Dialog`; restated here, it
      // is what keeps the keyboard inside the drawer
      disableEnforceFocus={false}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': labelId,
          // @ts-expect-error data attributes are valid on the paper
          'data-testid': testId,
          sx: PAPER_SX
        }
      }}
    >
      <ThemeProvider theme={wideScreenTheme}>
        <Box className="u-flex u-flex-items-center u-ph-1 u-pv-half">
          <span id={labelId} className="u-visuallyhidden">
            {label}
          </span>
          <Box className="u-flex u-flex-auto u-flex-items-center u-ov-hidden">
            {header}
          </Box>
          <Tooltip title={closeLabel}>
            <IconButton
              aria-label={closeLabel}
              onClick={onClose}
              data-testid={closeButtonTestId}
            >
              <Icon icon={Cross} />
            </IconButton>
          </Tooltip>
        </Box>
        <Box className="u-flex u-flex-column u-flex-auto u-ov-auto">
          {children}
        </Box>
      </ThemeProvider>
    </Drawer>
  )
}
