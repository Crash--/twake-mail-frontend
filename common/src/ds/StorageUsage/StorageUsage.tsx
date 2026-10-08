// Upstream to twake-ui: no, the look of tmail-flutter's Settings > Storage
// (`StorageView`): a cloud in a 64 px light circle, then in a 350 px column
// the space used in Semi Bold 18 black, "of … used" and "Available: …" in
// 9 px grey, over a thin gauge; on a phone the cloud above the line.
import { Icon } from '@linagora/twake-icons'
import { Box, Typography } from '@linagora/twake-mui'
import { useId, type ReactElement } from 'react'

import { Cloud } from '@/ds/FlutterIcons/FlutterIcons'
import { StorageGauge } from '@/ds/StorageGauge/StorageGauge'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

const ROOT_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  pl: 2
} as const

/** On a phone, as tmail-flutter: the cloud above, the line as wide as the screen */
const PHONE_ROOT_SX = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
  px: '8px'
} as const

const CIRCLE_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 64,
  height: 64,
  borderRadius: '50%',
  bgcolor: '#F6FAFF',
  color: 'primary.main'
} as const

const COLUMN_SX = { width: 351, maxWidth: '100%', minWidth: 0 } as const

const PHONE_COLUMN_SX = { width: '100%', minWidth: 0 } as const

const USED_SX = {
  fontSize: 18,
  lineHeight: '23px',
  fontWeight: 600,
  color: '#000000'
} as const

const SMALL_SX = {
  fontSize: 9,
  lineHeight: '14px',
  color: 'rgba(66, 66, 68, 0.9)'
} as const

export interface StorageUsageProps {
  /** The space used, e.g. "1.2 MB" */
  used: string
  /** After it, e.g. "of 50 MB used" */
  ofLimit: string
  /** At the end of the line, e.g. "Available: 48.8 MB" */
  available: string
  /** Share used, from 0 to 100 */
  percent: number
  state?: 'normal' | 'warning' | 'full'
  'data-testid'?: string
  'data-used'?: number
}

/** The storage used and left, with its gauge */
export function StorageUsage({
  used,
  ofLimit,
  available,
  percent,
  state = 'normal',
  'data-testid': testId,
  'data-used': dataUsed
}: StorageUsageProps): ReactElement {
  const labelId = useId()
  const isPhone = useScreenSize() === 'mobile'
  return (
    <Box
      sx={isPhone ? PHONE_ROOT_SX : ROOT_SX}
      data-testid={testId}
      data-used={dataUsed}
    >
      <Box sx={CIRCLE_SX} aria-hidden="true">
        <Icon icon={Cloud} size={28} />
      </Box>
      <Box sx={isPhone ? PHONE_COLUMN_SX : COLUMN_SX}>
        <Box className="u-flex u-flex-items-baseline">
          <Typography id={labelId} component="p" sx={{ m: 0 }}>
            <Box component="span" sx={USED_SX}>
              {used}
            </Box>{' '}
            <Box component="span" sx={SMALL_SX}>
              {ofLimit}
            </Box>
          </Typography>
          <Box component="span" className="u-flex-auto" />
          <Box component="span" sx={SMALL_SX}>
            {available}
          </Box>
        </Box>
        <StorageGauge
          value={percent}
          state={state}
          labelledBy={labelId}
          valueText={`${used} ${ofLimit}`}
          look="settings"
          className="u-mt-half"
        />
      </Box>
    </Box>
  )
}
