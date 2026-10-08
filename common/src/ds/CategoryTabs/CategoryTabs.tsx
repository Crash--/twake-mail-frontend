// Upstream to twake-ui: no, the look of tmail-flutter's category tabs
// (`KeyboardShortcutsTabView`): a 52 px bar at most 618 px wide, each tab of
// its own width, the label in grey Regular 14 (16 px in, on two lines when
// it has to), a 1 px blue line under the
// selected one, a light divider under the bar. Below the desktop size, as
// wide as the screen, each tab its share, 82 px high: a 20 px grey icon over
// a shorter label. twake-mui does not export `Tab`.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Box, Tab, Tabs } from '@mui/material'
import { useId, type ReactElement, type ReactNode } from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

const TABS_SX = {
  minHeight: 52,
  maxWidth: 618,
  borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
  '& .MuiTabs-indicator': { height: '1px', backgroundColor: '#007AFF' }
} as const

const TAB_SX = {
  minHeight: 52,
  minWidth: 0,
  px: '16px',
  fontSize: 14,
  fontWeight: 400,
  lineHeight: '20px',
  letterSpacing: '0.25px',
  textTransform: 'none',
  // tmail-flutter's labels keep their grey once selected: the blue line
  // under the tab says which one is
  color: '#424244',
  '&.Mui-selected': { color: '#424244' }
} as const

const COMPACT_TABS_SX = {
  ...TABS_SX,
  minHeight: 82,
  maxWidth: 'none'
} as const

const COMPACT_TAB_SX = {
  ...TAB_SX,
  flex: '1 1 0',
  minHeight: 82,
  gap: '10px',
  '& .MuiTab-iconWrapper': { m: 0, color: '#686E76' }
} as const

/** The list of the tab, 40 px under the bar */
const PANEL_SX = { pt: '40px' } as const

export interface CategoryTab {
  id: string
  label: string
  /** Width of the tab in px, as tmail-flutter sizes each */
  width?: number
  /** Below the desktop size: a shorter label, under this icon */
  shortLabel?: string
  icon?: IconProps['icon']
}

export interface CategoryTabsProps {
  tabs: readonly CategoryTab[]
  value: string
  onChange: (id: string) => void
  /** Names the tab list */
  label: string
  /** The panel of the selected tab */
  children: ReactNode
  'data-testid'?: string
}

/** Tabs and the panel of the selected one (the ARIA tabs pattern) */
export function CategoryTabs({
  tabs,
  value,
  onChange,
  label,
  children,
  'data-testid': testId
}: CategoryTabsProps): ReactElement {
  const id = useId()
  const isCompact = useScreenSize() !== 'desktop'
  return (
    <Box data-testid={testId}>
      <Tabs
        value={value}
        onChange={(_event, next: string) => {
          onChange(next)
        }}
        aria-label={label}
        variant={isCompact ? 'fullWidth' : 'scrollable'}
        scrollButtons={false}
        sx={isCompact ? COMPACT_TABS_SX : TABS_SX}
      >
        {tabs.map(tab => (
          <Tab
            key={tab.id}
            value={tab.id}
            label={isCompact ? (tab.shortLabel ?? tab.label) : tab.label}
            icon={
              isCompact && tab.icon !== undefined ? (
                <Icon icon={tab.icon} size={20} aria-hidden="true" />
              ) : undefined
            }
            iconPosition="top"
            id={`${id}-tab-${tab.id}`}
            aria-controls={`${id}-panel`}
            sx={isCompact ? COMPACT_TAB_SX : { ...TAB_SX, width: tab.width }}
          />
        ))}
      </Tabs>
      <Box
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${value}`}
        sx={PANEL_SX}
      >
        {children}
      </Box>
    </Box>
  )
}
