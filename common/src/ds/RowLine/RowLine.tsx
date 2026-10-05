// Upstream to twake-ui: yes, with `VirtualizedTable` row layouts. A one-line
// row where a title and its preview share the width: the title keeps its
// natural width (up to 70 %), the preview takes what is left and is cut
// first. Flex utilities cannot say it: both items would shrink alike.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export interface RowLineProps {
  /** Before the title, never cut (label chips, a priority icon) */
  leading?: ReactNode
  /** The title (a subject): cut with an ellipsis past 70 % of the line */
  primary: ReactNode
  /** After the title (a preview): takes the room left, cut first */
  secondary?: ReactNode
  /** After the preview, never cut (where the email is found) */
  trailing?: ReactNode
  'data-testid'?: string
}

/**
 * The content of a one-line list row: leading, title, preview, trailing,
 * vertically centred, on a single line whatever their size.
 */
export function RowLine({
  leading,
  primary,
  secondary,
  trailing,
  'data-testid': testId
}: RowLineProps): ReactElement {
  return (
    <Box
      component="span"
      className="u-flex u-flex-items-center"
      data-testid={testId}
    >
      {leading}
      <Box
        component="span"
        className="u-ellipsis"
        sx={{ flex: '0 1 auto', minWidth: 0, maxWidth: '70%' }}
      >
        {primary}
      </Box>
      {secondary === undefined ? null : (
        <Box
          component="span"
          className="u-ellipsis"
          sx={{ flex: '1 1 0', minWidth: 0, marginLeft: 1 }}
        >
          {secondary}
        </Box>
      )}
      {trailing}
    </Box>
  )
}
