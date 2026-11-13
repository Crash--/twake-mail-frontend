// Upstream to twake-ui: yes, as the `subheader` of `Nav`. twake-mui only has
// `ListSubheader` (14/600 on a contrast background, which also breaks a
// `role="tree"` it is put in) and `NavDesktopDropdown`, whose chevron is
// pushed to the far end, shown only past `limit` children, with no room for
// actions, and which renders nothing below `lg`.
import { Icon, Dropdown, Right } from '@linagora/twake-icons'
import { Box, ButtonBase, Typography, radius } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { TOUCH_TARGET_SIZE } from '@/ds/TouchTargets/TouchTargets'
import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

/** twake-mui's `xsmall` icon button, the size of the actions off touch */
const ACTION_SIZE = 26
const PHONE_MEDIA = `@media ${SCREEN_QUERIES.mobile}`

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
  py: 0,
  // The toggle is a flex item, not an inline box sitting on the baseline
  display: 'flex',
  alignItems: 'center'
} as const

/**
 * The title of a section of a sidebar ("Folders", "Labels"), a heading in the
 * caption variant, in secondary text, outside the list it titles, and its actions, 24 px high
 * with 24 px above (what comes under it sets its own gap, 12 px on phones
 * as in the Figma). With `toggle`,
 * the title is a button holding the arrow of the section, in a 24 px box
 * right after the text, that expands and collapses it.
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
      // The actions are 26 px boxes around 16 px glyphs: their glyphs end
      // 17 px before the edge
      sx={{
        minHeight: 24,
        mt: '24px',
        pl: 2,
        pr: '12px',
        // Phones: the 44 px touch targets of the actions spill over the
        // margins, above the next row, instead of growing the title row
        [PHONE_MEDIA]: {
          '& .MuiIconButton-root': {
            my: `${(ACTION_SIZE - TOUCH_TARGET_SIZE) / 2}px`,
            position: 'relative',
            zIndex: 1
          },
          // Over the twake-css padding the list sets for larger screens
          '& + *': { paddingTop: '12px !important' }
        }
      }}
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
              minHeight: 24,
              borderRadius: radius.sm
            }}
          >
            {title}
            <Icon
              icon={toggle.isExpanded ? Dropdown : Right}
              size={12}
              aria-hidden
            />
          </ButtonBase>
        )}
      </Typography>
      {actions}
    </Box>
  )
}
