// Upstream to twake-ui: yes, as the `subheader` of `Nav`. twake-mui only has
// `ListSubheader` (14/600 on a contrast background, which also breaks a
// `role="tree"` it is put in) and `NavDesktopDropdown`, whose chevron is
// pushed to the far end, shown only past `limit` children, with no room for
// actions, and which renders nothing below `lg`.
import { Bottom, Icon, Right } from '@linagora/twake-icons'
import { Box, ButtonBase, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export interface NavSectionToggle {
  isExpanded: boolean
  onToggle: () => void
  /** Id of the element the title expands and collapses (`aria-controls`) */
  controlsId?: string
  'data-testid'?: string
}

export interface NavSectionHeaderProps {
  title: string
  /** Id of the heading, for the `aria-labelledby` of the list it titles */
  titleId: string
  /** Makes the title a button that expands and collapses the section */
  toggle?: NavSectionToggle
  /** Icon buttons (each with its `aria-label` and tooltip) at the end */
  actions?: ReactNode
  'data-testid'?: string
}

const TITLE_SX = {
  color: 'text.secondary',
  fontSize: 12,
  fontWeight: 500,
  lineHeight: '15.8px',
  letterSpacing: 0.5,
  py: 0
} as const

/**
 * The title of a section of a sidebar ("Folders", "Labels"): a heading in
 * 12/500 secondary text, outside the list it titles, and its actions,
 * 32 px high with 10 px above and 8 px below. With
 * `toggle`, the title is a button holding the chevron of the section, 8 px
 * after the text (Figma), that expands and collapses it.
 */
export function NavSectionHeader({
  title,
  titleId,
  toggle,
  actions,
  'data-testid': testId
}: NavSectionHeaderProps): ReactElement {
  return (
    <Box
      className="u-flex u-flex-items-center"
      sx={{ minHeight: 32, mt: '20px', mb: '8px', pl: 2, pr: '13px' }}
    >
      <Typography
        id={titleId}
        variant="caption"
        component="h2"
        className="u-flex-auto"
        data-testid={testId}
        sx={TITLE_SX}
      >
        {toggle === undefined ? (
          title
        ) : (
          <ButtonBase
            onClick={toggle.onToggle}
            aria-expanded={toggle.isExpanded}
            aria-controls={toggle.controlsId}
            data-testid={toggle['data-testid']}
            sx={{
              font: 'inherit',
              letterSpacing: 'inherit',
              color: 'inherit',
              gap: 1,
              minHeight: 32,
              borderRadius: 1
            }}
          >
            {title}
            <Icon
              icon={toggle.isExpanded ? Bottom : Right}
              size={16}
              aria-hidden
            />
          </ButtonBase>
        )}
      </Typography>
      {actions}
    </Box>
  )
}
