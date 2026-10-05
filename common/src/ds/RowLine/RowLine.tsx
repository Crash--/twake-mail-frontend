// Upstream to twake-ui: yes, with `VirtualizedTable` row layouts. A one-line
// row where a title and its preview share the width: the title keeps its
// natural width (up to a maximum), the preview takes what is left and is cut
// first. Flex utilities cannot say it: both items would shrink alike.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { rowTextSx } from './rowText'

/** Widest the title of a row of the design gets, in px (Figma 262 to 268) */
const PRIMARY_MAX_WIDTH = 268

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
   * The row stands out (an unread email): the title is Semi Bold and the
   * preview in the main text colour rather than the secondary one
   */
  isStrong?: boolean
  'data-testid'?: string
}

/**
 * The content of a one-line list row: leading, title, preview, trailing,
 * vertically centred, on a single line whatever their size, in the text
 * style of the mail list (14 / 18.4).
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
          maxWidth: PRIMARY_MAX_WIDTH
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
            color: isStrong ? 'text.primary' : 'text.secondary',
            flex: '1 1 0',
            minWidth: 0,
            marginLeft: 1
          }}
        >
          {secondary}
        </Box>
      )}
      {trailing}
    </Box>
  )
}
