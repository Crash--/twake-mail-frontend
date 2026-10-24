// Upstream to twake-ui: no. Category tabs: twake-mui's `Tabs` and `Tab`, each
// tab as wide as its label on one line, a divider under the bar. Below the
// desktop size, as wide as the screen, each tab its share: an icon over a
// shorter label.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Box, Tab, Tabs } from '@linagora/twake-mui'
import { useId, type ReactElement, type ReactNode } from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

const TABS_SX = {
  borderBottom: '1px solid',
  borderColor: 'divider'
} as const

// Each label on one line, the width of the label
const TAB_SX = { minWidth: 0, whiteSpace: 'nowrap' } as const

const COMPACT_TABS_SX = { ...TABS_SX, maxWidth: 'none' } as const

const COMPACT_TAB_SX = {
  ...TAB_SX,
  flex: '1 1 0',
  minHeight: 82,
  gap: '10px',
  '& .MuiTab-iconWrapper': { m: 0 }
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
