// Upstream to twake-ui: yes. twake-mui has no top bar: its `Layout` story
// fakes one, and each Twake app builds its own (Calendar has a desktop, a
// tablet and a mobile `Menubar`). This one is tmail-flutter's app bar of
// phones and tablets (`MobileAppBarThreadWidget`, `SearchBarView`): a menu
// button, the title in Bold 21, the actions at the end, and the search under
// the bar, as wide as the screen.
import { Icon } from '@linagora/twake-icons'
import { Box, IconButton, Tooltip } from '@linagora/twake-mui'
import {
  useImperativeHandle,
  useRef,
  type ReactElement,
  type ReactNode,
  type Ref
} from 'react'

import { Burger } from '@/ds/FlutterIcons/FlutterIcons'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

/** The bar of tmail-flutter: 52 px, 16 px in on a phone, 32 px on a tablet */
const BAR_HEIGHT = 52

function barSx(isPhone: boolean): Record<string, unknown> {
  return {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    height: BAR_HEIGHT,
    px: isPhone ? '16px' : '32px',
    bgcolor: 'background.paper'
  }
}

/** Its menu button: tmail-flutter's light grey 28 px icon, 5 px around */
const MENU_SX = { p: '5px', color: '#99A2AD' } as const

/** Its title: Bold 21, black, 16 px after the menu button */
const TITLE_SX = {
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  mx: '16px',
  '& .MuiTypography-root': {
    fontSize: 21,
    fontWeight: 700,
    lineHeight: '28px',
    color: '#000000'
  }
} as const

/** The search under it: 12 px in on a phone, 24 px on a tablet, 8 px below */
function searchSx(isPhone: boolean): Record<string, unknown> {
  return {
    flexShrink: 0,
    px: isPhone ? '12px' : '24px',
    pb: '8px',
    bgcolor: 'background.paper'
  }
}

/**
 * The actions, as tmail-flutter's filter: a light grey 24 px icon, 8 px
 * around, blue when on
 */
const ACTIONS_SX = {
  display: 'flex',
  alignItems: 'center',
  color: '#99A2AD',
  '& .MuiIconButton-root': { color: 'inherit', p: '8px' },
  '& .MuiIconButton-root.MuiIconButton-colorPrimary': { color: '#007AFF' }
} as const

export interface AppTopBarMenu {
  /** Name and tooltip of the button, e.g. "Show folders" */
  label: string
  onOpen: () => void
  'data-testid'?: string
}

export interface AppTopBarSearchActions {
  /** Moves the focus into the search (a keyboard shortcut) */
  focusSearch: () => void
}

export interface AppTopBarProps {
  /** The current folder */
  title: ReactNode
  /** A search field, shown under the bar; null for none */
  search: ReactNode | null
  /** Buttons at the end of the bar, e.g. the filter */
  actions: ReactNode
  /** The button opening the navigation drawer */
  menu: AppTopBarMenu
  /** Reaches that button, e.g. to give it the focus back */
  menuButtonRef?: Ref<HTMLButtonElement>
  /** Receives `AppTopBarSearchActions`, as MUI's `action` props */
  searchActions?: Ref<AppTopBarSearchActions>
  'data-testid'?: string
}

/**
 * The bar at the top of the app below the desktop size, as tmail-flutter's:
 * the menu button, the title and the actions, then the search under it.
 */
export function AppTopBar({
  title,
  search,
  actions,
  menu,
  menuButtonRef,
  searchActions,
  'data-testid': testId
}: AppTopBarProps): ReactElement {
  const isPhone = useScreenSize() === 'mobile'
  const searchRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(
    searchActions,
    () => ({
      focusSearch: () => {
        searchRef.current?.querySelector('input')?.focus()
      }
    }),
    []
  )

  return (
    <Box
      component="header"
      className="u-flex u-flex-column"
      data-testid={testId}
    >
      <Box sx={barSx(isPhone)}>
        <Tooltip title={menu.label}>
          <IconButton
            ref={menuButtonRef}
            aria-label={menu.label}
            aria-haspopup="dialog"
            onClick={menu.onOpen}
            sx={MENU_SX}
            data-testid={menu['data-testid']}
          >
            <Icon icon={Burger} size={28} />
          </IconButton>
        </Tooltip>
        <Box sx={TITLE_SX}>{title}</Box>
        <Box sx={ACTIONS_SX}>{actions}</Box>
      </Box>
      {search === null ? null : (
        <Box ref={searchRef} sx={searchSx(isPhone)}>
          {search}
        </Box>
      )}
    </Box>
  )
}
