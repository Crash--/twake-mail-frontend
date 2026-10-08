// Upstream to twake-ui: no, the look of tmail-flutter's category tabs
// (`KeyboardShortcutsTabView`): a 52 px bar at most 618 px wide, each tab of
// its own width, the label in Regular 14, a 1 px blue line under the
// selected one, a light divider under the bar. twake-mui does not export
// `Tab`.
import { Box, Tab, Tabs } from '@mui/material'
import { useId, type ReactElement, type ReactNode } from 'react'

const TABS_SX = {
  minHeight: 52,
  maxWidth: 618,
  borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
  '& .MuiTabs-indicator': { height: '1px', backgroundColor: '#007AFF' }
} as const

const TAB_SX = {
  minHeight: 52,
  minWidth: 0,
  px: 1,
  fontSize: 14,
  fontWeight: 400,
  lineHeight: '20px',
  letterSpacing: 0,
  textTransform: 'none',
  color: 'rgba(0, 0, 0, 0.6)',
  '&.Mui-selected': { color: '#007AFF' }
} as const

export interface CategoryTab {
  id: string
  label: string
  /** Width of the tab in px, as tmail-flutter sizes each */
  width?: number
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
  return (
    <Box data-testid={testId}>
      <Tabs
        value={value}
        onChange={(_event, next: string) => {
          onChange(next)
        }}
        aria-label={label}
        variant="scrollable"
        scrollButtons={false}
        sx={TABS_SX}
      >
        {tabs.map(tab => (
          <Tab
            key={tab.id}
            value={tab.id}
            label={tab.label}
            id={`${id}-tab-${tab.id}`}
            aria-controls={`${id}-panel`}
            sx={{ ...TAB_SX, width: tab.width }}
          />
        ))}
      </Tabs>
      <Box
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${value}`}
      >
        {children}
      </Box>
    </Box>
  )
}
