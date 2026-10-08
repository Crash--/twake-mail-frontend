// Upstream to twake-ui: no, the look of tmail-flutter's sidebar categories
// ("Personal folders", "Team-mailboxes" under "Folders"): a 36 px row like a
// folder (a 16 px icon, the name, the chevron right after it) that expands
// and collapses the tree under it, indented by 8 px.
import { Bottom, Icon, type IconProps, Right } from '@linagora/twake-icons'
import { Box, ButtonBase } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const BUTTON_SX = {
  display: 'flex',
  // The margins of the rows of a tree
  mx: '16px',
  width: 'calc(100% - 32px)',
  justifyContent: 'flex-start',
  gap: '12px',
  minHeight: 36,
  pl: '8px',
  pr: '8px',
  borderRadius: '8px',
  color: 'rgba(66, 66, 68, 0.9)',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '18.4px',
  letterSpacing: 0.25,
  textAlign: 'start',
  '&:hover': { bgcolor: 'rgba(29, 25, 43, 0.04)' }
} as const

const CHEVRON_SX = {
  display: 'flex',
  ml: '-4px',
  color: 'rgba(66, 66, 66, 0.64)'
} as const

export interface NavCategoryProps {
  title: string
  /** Its id, to name the tree it holds */
  titleId: string
  /** A 16 px icon before the title */
  icon: IconProps['icon']
  isExpanded: boolean
  onToggle: () => void
  /** Id of the box it expands and collapses */
  controlsId: string
  /** The tree, shown while expanded */
  children: ReactNode
  toggleTestId?: string
  'data-testid'?: string
}

/** A row of the sidebar that expands and collapses the tree under it */
export function NavCategory({
  title,
  titleId,
  icon,
  isExpanded,
  onToggle,
  controlsId,
  children,
  toggleTestId,
  'data-testid': testId
}: NavCategoryProps): ReactElement {
  return (
    <Box data-testid={testId}>
      {/* A heading under the one of its section, holding the toggle */}
      <Box component="h3" sx={{ m: 0 }}>
        <ButtonBase
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-controls={controlsId}
          sx={BUTTON_SX}
          data-testid={toggleTestId}
        >
          <Box component="span" className="u-flex">
            <Icon icon={icon} size={16} aria-hidden="true" />
          </Box>
          <span id={titleId}>{title}</span>
          <Box component="span" sx={CHEVRON_SX}>
            <Icon
              icon={isExpanded ? Bottom : Right}
              size={16}
              aria-hidden="true"
            />
          </Box>
        </ButtonBase>
      </Box>
      <Box id={controlsId} hidden={!isExpanded} sx={{ pl: '8px' }}>
        {children}
      </Box>
    </Box>
  )
}
