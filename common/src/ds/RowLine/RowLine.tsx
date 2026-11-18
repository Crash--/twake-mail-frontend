// Upstream to twake-ui: yes, with `VirtualizedTable` row layouts. A one-line
// row where a title and its preview share the width: the title keeps its
// natural width (up to a maximum), the preview takes what is left and is cut
// first. Flex utilities cannot say it: both items would shrink alike.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { ROW_MUTED_COLOR, rowTextSx } from './rowText'

/**
 * Widest the title gets beside a preview: 55 % of their room. Without a
 * preview, all of it
 */
const PRIMARY_MAX_WIDTH = '55%'

export interface RowLineProps {
  /** First, never cut (label chips) */
  start?: ReactNode
  /** After `start`, before the title, never cut (state icons) */
  leading?: ReactNode
  /** The title (a subject): cut with an ellipsis past its maximum width */
  primary: ReactNode
  /**
   * After the title (a preview), in Medium: takes the room left, cut first;
   * null when there is none
   */
  secondary?: ReactNode
  /** After the preview, never cut (where the email is found) */
  trailing?: ReactNode
  /**
   * The row stands out (an unread email): the title is Semi Bold rather than
   * Regular, and the preview in the primary text colour, not the secondary
   */
  isStrong?: boolean
  'data-testid'?: string
}

/**
 * The content of a one-line list row: start, leading, title, preview, trailing,
 * vertically centred, on a single line whatever their size.
 */
export function RowLine({
  start,
  leading,
  primary,
  secondary,
  trailing,
  isStrong = false,
  'data-testid': testId
}: RowLineProps): ReactElement {
  const hasSecondary = secondary !== undefined && secondary !== null
  return (
    <Box
      component="span"
      className="u-flex u-flex-items-center"
      sx={rowTextSx(false)}
      data-testid={testId}
    >
      {start}
      {leading}
      {/* The share of the title counts in the room of the title and the
          preview only, out of the icons and labels before them */}
      <Box
        component="span"
        className="u-flex u-flex-items-center"
        sx={{ flex: '1 1 0', minWidth: 0 }}
      >
        <Box
          component="span"
          className="u-ellipsis"
          sx={{
            ...rowTextSx(isStrong),
            flex: '0 1 auto',
            minWidth: 0,
            maxWidth: hasSecondary ? PRIMARY_MAX_WIDTH : '100%'
          }}
        >
          {primary}
        </Box>
        {hasSecondary ? (
          <Box
            component="span"
            className="u-ellipsis"
            sx={{
              typography: 'subtitle1',
              color: isStrong ? 'text.primary' : ROW_MUTED_COLOR,
              flex: '1 1 0',
              minWidth: 0,
              marginLeft: '8px'
            }}
          >
            {secondary}
          </Box>
        ) : null}
      </Box>
      {trailing}
    </Box>
  )
}
