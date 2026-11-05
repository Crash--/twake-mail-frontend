// Upstream to twake-ui: yes, as the expand arrow of `Nav` items and
// subheaders. twake-icons draws `Dropdown` and `Right` across most of their
// 16 px box; the design's arrow is a 7.7 px chevron in a 16 px frame.
import { Icon, Dropdown, Right } from '@linagora/twake-icons'
import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

/** The frame of the arrow, and the glyph whose chevron is 7.7 px wide in it */
const FRAME_SIZE = 16
const GLYPH_SIZE = 11

const FRAME_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 'none',
  width: FRAME_SIZE,
  height: FRAME_SIZE
} as const

export interface NavChevronProps {
  /** Down while expanded, right while collapsed */
  isExpanded: boolean
}

/** The decorative arrow of a sidebar section, category or folder */
export function NavChevron({ isExpanded }: NavChevronProps): ReactElement {
  return (
    <Box component="span" aria-hidden="true" sx={FRAME_SX}>
      <Icon icon={isExpanded ? Dropdown : Right} size={GLYPH_SIZE} />
    </Box>
  )
}
