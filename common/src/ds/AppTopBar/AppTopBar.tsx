// Upstream to twake-ui: yes. twake-mui has no top bar: its `Layout` story
// fakes one, and each Twake app builds its own (Calendar has a desktop, a
// tablet and a mobile `Menubar`). This one has the slots and the
// responsive behaviour they share: a menu button below the desktop size,
// the search folded behind a button on phones.
import { Burger, Icon, Left, Magnifier } from '@linagora/twake-icons'
import {
  AppBar,
  Box,
  IconButton,
  Toolbar,
  Tooltip,
  type Theme
} from '@linagora/twake-mui'
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type Ref
} from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

/** Height of the bar on desktops, as in the design */
const DESKTOP_HEIGHT = 50
const TABLET_SEARCH_MAX_WIDTH = 768
// A shadow, not a border: the bar stays exactly as high as its toolbar
const BAR_SX = {
  boxShadow: (theme: Theme) => `0 1px 0 ${theme.palette.divider}`
} as const
const SEARCH_SX = { width: '100%', maxWidth: TABLET_SEARCH_MAX_WIDTH } as const
// `&&`: the theme sets the height of the toolbar at each breakpoint
const DESKTOP_TOOLBAR_SX = {
  '&&': { minHeight: DESKTOP_HEIGHT, height: DESKTOP_HEIGHT }
} as const

export interface AppTopBarMenu {
  /** Name and tooltip of the button, e.g. "Show folders" */
  label: string
  onOpen: () => void
  'data-testid'?: string
}

export interface AppTopBarTestIds {
  openSearch?: string
  closeSearch?: string
}

export interface AppTopBarSearchActions {
  /**
   * Moves the focus into the search, unfolding it first on phones (a
   * keyboard shortcut)
   */
  focusSearch: () => void
}

export interface AppTopBarProps {
  /** The logotype, on tablets and desktops */
  title: ReactNode
  /** What phones show instead of the logotype, e.g. the current folder */
  compactTitle?: ReactNode
  /**
   * A search field: centred on tablets, folded behind a button on phones.
   * Desktops do not show it here: their search sits in the page, under the
   * bar (`ds/SearchRow`)
   */
  search: ReactNode
  /** Buttons at the end of the bar: app switcher, account */
  actions: ReactNode
  /** The button opening the navigation drawer, below the desktop size */
  menu: AppTopBarMenu
  /** Name and tooltip of the button unfolding the search on phones */
  openSearchLabel: string
  /** Name and tooltip of the button folding it back */
  closeSearchLabel: string
  /** Receives `AppTopBarSearchActions`, as MUI's `action` props */
  searchActions?: Ref<AppTopBarSearchActions>
  testIds?: AppTopBarTestIds
  'data-testid'?: string
}

/**
 * The bar at the top of the app.
 *
 * - Desktop (1200 px and more): 50 px high, title at the start, actions at
 *   the end; the search is in the page.
 * - Tablet: the same, after a button opening the navigation drawer.
 * - Phone (below 600 px): menu button, compact title, a search button and
 *   the actions. The search button unfolds the search over the whole bar
 *   and moves the focus into it; the back button or Escape fold it and give
 *   the focus back to the search button.
 *
 * `searchActions.focusSearch()` reaches the search on every screen size.
 */
export function AppTopBar({
  title,
  compactTitle,
  search,
  actions,
  menu,
  openSearchLabel,
  closeSearchLabel,
  searchActions,
  testIds = {},
  'data-testid': testId
}: AppTopBarProps): ReactElement {
  const screenSize = useScreenSize()
  const isPhone = screenSize === 'mobile'
  const isDesktop = screenSize === 'desktop'
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const openSearchRef = useRef<HTMLButtonElement>(null)
  // Set when the user folds the search: the focus goes back to its button
  const restoreFocusRef = useRef(false)
  const isSearchUnfolded = isPhone && isSearchOpen

  useEffect(() => {
    if (isSearchUnfolded) {
      searchRef.current?.querySelector('input')?.focus()
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false
      openSearchRef.current?.focus()
    }
  }, [isSearchUnfolded])

  useImperativeHandle(
    searchActions,
    () => ({
      focusSearch: () => {
        if (isPhone && !isSearchOpen) {
          // Focused once unfolded, by the effect above
          setIsSearchOpen(true)
          return
        }
        searchRef.current?.querySelector('input')?.focus()
      }
    }),
    [isPhone, isSearchOpen]
  )

  const handleOpenSearch = (): void => {
    setIsSearchOpen(true)
  }

  const handleCloseSearch = (): void => {
    restoreFocusRef.current = true
    setIsSearchOpen(false)
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    handleCloseSearch()
  }

  let content: ReactElement
  if (isSearchUnfolded) {
    content = (
      <>
        <Tooltip title={closeSearchLabel}>
          <IconButton
            aria-label={closeSearchLabel}
            onClick={handleCloseSearch}
            data-testid={testIds.closeSearch}
          >
            <Icon icon={Left} />
          </IconButton>
        </Tooltip>
        <Box
          ref={searchRef}
          className="u-flex u-flex-auto u-ov-hidden"
          onKeyDown={handleSearchKeyDown}
        >
          {search}
        </Box>
      </>
    )
  } else {
    const menuButton = isDesktop ? null : (
      <Tooltip title={menu.label}>
        <IconButton
          edge="start"
          aria-label={menu.label}
          aria-haspopup="dialog"
          onClick={menu.onOpen}
          data-testid={menu['data-testid']}
        >
          <Icon icon={Burger} />
        </IconButton>
      </Tooltip>
    )
    content = isPhone ? (
      <>
        {menuButton}
        <Box className="u-flex u-flex-auto u-flex-items-center u-ov-hidden u-ml-half">
          {compactTitle ?? title}
        </Box>
        <Tooltip title={openSearchLabel}>
          <IconButton
            ref={openSearchRef}
            aria-label={openSearchLabel}
            onClick={handleOpenSearch}
            data-testid={testIds.openSearch}
          >
            <Icon icon={Magnifier} />
          </IconButton>
        </Tooltip>
        {actions}
      </>
    ) : (
      <>
        {menuButton}
        {title}
        {isDesktop ? (
          <Box className="u-flex-auto" />
        ) : (
          <Box
            ref={searchRef}
            className="u-flex u-flex-auto u-flex-justify-center u-ph-2"
          >
            <Box sx={SEARCH_SX}>{search}</Box>
          </Box>
        )}
        {actions}
      </>
    )
  }

  return (
    <AppBar
      position="static"
      color="inherit"
      elevation={0}
      sx={BAR_SX}
      data-testid={testId}
    >
      <Toolbar
        className="u-flex u-flex-items-center"
        sx={isDesktop ? DESKTOP_TOOLBAR_SX : undefined}
      >
        {content}
      </Toolbar>
    </AppBar>
  )
}
