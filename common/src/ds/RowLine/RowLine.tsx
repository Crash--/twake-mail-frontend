// Upstream to twake-ui: yes, with `VirtualizedTable` row layouts. A one-line
// row where a title and its preview share the width: the title keeps its
// natural width (up to a maximum), the preview takes what is left and is cut
// first. Flex utilities cannot say it: both items would shrink alike.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { ROW_MUTED_COLOR, rowTextSx } from './rowText'

/**
 * Widest the title gets: half the row, as tmail-flutter (40 % when label
 * chips come first)
 */
const PRIMARY_MAX_WIDTH = '50%'
const PRIMARY_MAX_WIDTH_AFTER_LEADING = '40%'

export interface RowLineProps {
  /** Before the title, never cut (label chips, a priority icon) */
  leading?: ReactNode
  /** The title (a subject): cut with an ellipsis past its maximum width */
  primary: ReactNode
  /** After the title (a preview): takes the room left, cut first */
  secondary?: ReactNode
  /** After the preview, never cut (where the email is found) */
  trailing?: ReactNode
  /**
   * The row stands out (an unread email): the title is Semi Bold and black
   * rather than Regular and steel grey; the preview stays steel grey
   */
  isStrong?: boolean
  'data-testid'?: string
}

/**
 * The content of a one-line list row: leading, title, preview, trailing,
 * vertically centred, on a single line whatever their size, in the text
 * style of the mail list of tmail-flutter (12 / 16).
 */
export function RowLine({
  leading,
  primary,
  secondary,
  trailing,
  isStrong = false,
  'data-testid': testId
}: RowLineProps): ReactElement {
  return (
    <Box
      component="span"
      className="u-flex u-flex-items-center"
      sx={rowTextSx(false)}
      data-testid={testId}
    >
      {leading}
      <Box
        component="span"
        className="u-ellipsis"
        sx={{
          ...rowTextSx(isStrong),
          flex: '0 1 auto',
          minWidth: 0,
          maxWidth:
            leading === undefined || leading === null
              ? PRIMARY_MAX_WIDTH
              : PRIMARY_MAX_WIDTH_AFTER_LEADING
        }}
      >
        {primary}
      </Box>
      {secondary === undefined ? null : (
        <Box
          component="span"
          className="u-ellipsis"
          sx={{
            ...rowTextSx(false),
            fontWeight: 500,
            color: ROW_MUTED_COLOR,
            flex: '1 1 0',
            minWidth: 0,
            marginLeft: '12px'
          }}
        >
          {secondary}
        </Box>
      )}
      {trailing}
    </Box>
  )
}
