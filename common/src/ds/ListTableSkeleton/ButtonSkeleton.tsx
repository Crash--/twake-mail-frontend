// Upstream to twake-ui: yes, with the table variant of `ListItemSkeleton`
// (see `ListTableSkeleton`): the room of an icon button, which a touch
// screen makes 44 px (`TouchTargets`), and the shape of its icon.
import { Box, Skeleton } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { TOUCH_MEDIA, TOUCH_TARGET_SIZE } from '@/ds/TouchTargets/TouchTargets'

const BUTTON_SX = {
  width: 32,
  height: 32,
  [TOUCH_MEDIA]: { width: TOUCH_TARGET_SIZE, height: TOUCH_TARGET_SIZE }
} as const

/** The box of an icon button of a row, with a 20 px round shape in it */
export function ButtonSkeleton(): ReactElement {
  return (
    <Box
      className="u-flex u-flex-items-center u-flex-justify-center"
      sx={BUTTON_SX}
    >
      <Skeleton variant="circular" width={20} height={20} />
    </Box>
  )
}
