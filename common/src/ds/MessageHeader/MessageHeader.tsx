// Upstream to twake-ui: yes, see docs/twake-mui-gaps.md "Email header":
// twake-mui has no message header (identity, recipients, actions), and a
// flex row of them does not reflow on a phone.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

const ROOT_SX = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  gridTemplateAreas: '"avatar identity actions"',
  // tmail-flutter: 16 px between the avatar and the name
  columnGap: 2,
  rowGap: 0.5,
  alignItems: 'start',
  // Long addresses wrap instead of widening the page (RGAA 10.11)
  overflowWrap: 'anywhere',
  [`@media ${SCREEN_QUERIES.mobile}`]: {
    gridTemplateColumns: 'auto minmax(0, 1fr)',
    gridTemplateAreas: '"avatar identity" ". actions"'
  }
} as const

/** Without actions, no third column: its gap would push what follows */
const NO_ACTIONS_SX = {
  ...ROOT_SX,
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gridTemplateAreas: '"avatar identity"',
  [`@media ${SCREEN_QUERIES.mobile}`]: {}
} as const

export interface MessageHeaderProps {
  avatar: ReactNode
  /** Sender, date and recipients */
  identity: ReactNode
  /** The icon buttons at the end of the header, if any */
  actions?: ReactNode
  className?: string
  /**
   * `span` inside phrasing content, e.g. the button toggling a message of a
   * conversation
   */
  component?: 'div' | 'span'
}

/**
 * The header of a message: avatar, identity (sender, date, recipients) and
 * the icon buttons at the end of the line; on phones the actions go under the
 * identity, and long names and addresses wrap rather than overflow.
 */
export function MessageHeader({
  avatar,
  identity,
  actions,
  className,
  component = 'div'
}: MessageHeaderProps): ReactElement {
  const hasActions = actions !== undefined && actions !== null
  return (
    <Box
      component={component}
      className={className}
      sx={hasActions ? ROOT_SX : NO_ACTIONS_SX}
    >
      <Box component={component} sx={{ gridArea: 'avatar' }}>
        {avatar}
      </Box>
      <Box component={component} sx={{ gridArea: 'identity', minWidth: 0 }}>
        {identity}
      </Box>
      {!hasActions ? null : (
        <Box component={component} sx={{ gridArea: 'actions' }}>
          {actions}
        </Box>
      )}
    </Box>
  )
}
