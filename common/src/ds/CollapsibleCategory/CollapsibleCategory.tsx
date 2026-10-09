// Upstream to twake-ui: no, the look of tmail-flutter's mailbox categories
// in Settings > Folder visibility ("Folders", "Personal folders",
// "Team-mailboxes"): a 40 px heading, an optional 20 px icon, the title in
// Inter 14 / 18 black, the chevron right after it, and what it holds below,
// shown while expanded. `NavSectionHeader` is the 12 px grey title of the
// sidebar.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Box, ButtonBase } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { Bottom, Right } from '@/ds/FlutterIcons/FlutterIcons'
import { NESTED_LIST_SX } from '@/ds/FolderVisibilityRow/FolderVisibilityRow'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

const HEADING_SX = {
  display: 'flex',
  alignItems: 'center',
  minHeight: 40,
  m: 0
} as const

const BUTTON_SX = {
  gap: 1,
  minHeight: 32,
  px: '2px',
  borderRadius: '8px',
  color: TMAIL.textBlack,
  fontSize: 14,
  fontWeight: 400,
  lineHeight: '18px',
  letterSpacing: 0,
  '& .CollapsibleCategory-chevron': { p: '3px', display: 'flex' }
} as const

export interface CollapsibleCategoryProps {
  title: string
  /** Before the title, in tmail-flutter's steel grey */
  icon?: IconProps['icon'] | null
  isExpanded: boolean
  onToggle: () => void
  /** Id of what the title expands and collapses */
  controlsId: string
  /** Left padding of the heading in px: 12 for a bar, 10 for a category */
  inset?: number
  /** Holds list items (a `ul` named by the title, 10 px in), or blocks */
  isList?: boolean
  children: ReactNode
  'data-testid'?: string
  toggleTestId?: string
}

/** A heading that expands and collapses what it titles */
export function CollapsibleCategory({
  title,
  icon = null,
  isExpanded,
  onToggle,
  controlsId,
  inset = 12,
  isList = false,
  children,
  'data-testid': testId,
  toggleTestId
}: CollapsibleCategoryProps): ReactElement {
  return (
    <>
      <Box component="h2" sx={{ ...HEADING_SX, pl: `${inset - 2}px` }}>
        <ButtonBase
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-controls={controlsId}
          sx={BUTTON_SX}
          data-testid={toggleTestId}
        >
          {icon === null ? null : (
            <Box
              component="span"
              className="u-flex"
              sx={{ color: TMAIL.steel }}
            >
              <Icon icon={icon} size={20} aria-hidden="true" />
            </Box>
          )}
          {title}
          <span className="CollapsibleCategory-chevron">
            <Icon
              icon={isExpanded ? Bottom : Right}
              size={17}
              aria-hidden="true"
            />
          </span>
        </ButtonBase>
      </Box>
      {isExpanded ? (
        isList ? (
          <Box
            component="ul"
            id={controlsId}
            aria-label={title}
            sx={NESTED_LIST_SX}
            data-testid={testId}
          >
            {children}
          </Box>
        ) : (
          <Box id={controlsId} data-testid={testId}>
            {children}
          </Box>
        )
      ) : null}
    </>
  )
}
