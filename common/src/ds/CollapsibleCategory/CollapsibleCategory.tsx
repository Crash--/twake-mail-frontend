// Upstream to twake-ui: no. The folder groups of Settings > Folder
// visibility ("Folders", "Personal folders", "Team-mailboxes"): a heading in
// the small grey caption of the Figma, the chevron right after it, and what
// it holds below, shown while expanded. twake-mui's `NavDesktopDropdown` is
// a sidebar row, not a heading.
import { Bottom, Right } from '@linagora/twake-icons'
import { Box, ButtonBase } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { PlainList } from '@/ds/PlainList/PlainList'
import { Icon } from '@/ds/Icon/Icon'

const BUTTON_SX = {
  gap: '4px',
  minHeight: 24,
  px: '2px',
  borderRadius: '4px',
  color: 'text.secondary',
  typography: 'caption'
} as const

export interface CollapsibleCategoryProps {
  title: string
  isExpanded: boolean
  onToggle: () => void
  /** Id of what the title expands and collapses */
  controlsId: string
  /** `h3` for a category inside another one */
  headingLevel?: 'h2' | 'h3'
  /** Holds list items (a list named by the title), or blocks */
  isList?: boolean
  children: ReactNode
  'data-testid'?: string
  toggleTestId?: string
}

/** A heading that expands and collapses what it titles */
export function CollapsibleCategory({
  title,
  isExpanded,
  onToggle,
  controlsId,
  headingLevel = 'h2',
  isList = false,
  children,
  'data-testid': testId,
  toggleTestId
}: CollapsibleCategoryProps): ReactElement {
  return (
    <>
      <Box component={headingLevel} className="u-m-0 u-mt-1 u-mb-half">
        <ButtonBase
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-controls={controlsId}
          sx={BUTTON_SX}
          data-testid={toggleTestId}
        >
          {title}
          <Icon
            icon={isExpanded ? Bottom : Right}
            size={12}
            aria-hidden="true"
          />
        </ButtonBase>
      </Box>
      {/* Kept in the page, so that `aria-controls` always points to it */}
      <Box id={controlsId}>
        {!isExpanded ? null : isList ? (
          <PlainList label={title} data-testid={testId}>
            {children}
          </PlainList>
        ) : (
          <Box data-testid={testId}>{children}</Box>
        )}
      </Box>
    </>
  )
}
