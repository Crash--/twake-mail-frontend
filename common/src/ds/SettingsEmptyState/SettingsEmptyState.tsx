// Upstream to twake-ui: no, the look of tmail-flutter's empty lists of the
// settings ("No Rules Configured", `NoRulesWidget`): a 98 px light blue
// disc holding the icon, the title in Semi Bold 24 dark grey 12 px under it,
// what to do in Regular 16 grey, and 24 px lower an outlined blue pill at
// least 230 px wide to start.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Box, ButtonBase, Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { TMAIL } from '@/ds/TmailColors/tmailColors'

const ROOT_SX = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  maxWidth: 360,
  mx: 'auto',
  pt: 4
} as const

const CIRCLE_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 98,
  height: 98,
  borderRadius: '50%',
  bgcolor: TMAIL.bluePale,
  color: '#9EBFEB'
} as const

const TITLE_SX = {
  mt: '12px',
  fontSize: 24,
  lineHeight: '28px',
  fontWeight: 600,
  color: TMAIL.textGrey90
} as const

const TEXT_SX = {
  mt: '24px',
  fontSize: 16,
  lineHeight: '21px',
  color: TMAIL.textGrey64
} as const

const BUTTON_SX = {
  mt: '24px',
  gap: 1,
  minWidth: 230,
  height: 48,
  px: 4,
  borderRadius: '100px',
  border: '1px solid',
  borderColor: 'primary.main',
  color: 'primary.main',
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 500,
  letterSpacing: '0.1px',
  '&:hover': { bgcolor: TMAIL.blueHover }
} as const

export interface SettingsEmptyStateProps {
  icon: IconProps['icon']
  title: string
  text: string
  /** The button starting the list, e.g. "Create My First Rule" */
  action?: {
    label: string
    icon: IconProps['icon']
    onClick: () => void
    'data-testid'?: string
  }
  'data-testid'?: string
}

/** What an empty list of the settings shows */
export function SettingsEmptyState({
  icon,
  title,
  text,
  action,
  'data-testid': testId
}: SettingsEmptyStateProps): ReactElement {
  return (
    <Box sx={ROOT_SX} data-testid={testId}>
      <Box sx={CIRCLE_SX} aria-hidden="true">
        {/* tmail-flutter's drawings fill the disc: their frame is its size */}
        <Icon icon={icon} size={98} />
      </Box>
      <Typography component="h2" sx={TITLE_SX}>
        {title}
      </Typography>
      <Typography component="p" sx={TEXT_SX}>
        {text}
      </Typography>
      {action === undefined ? null : (
        <ButtonBase
          onClick={action.onClick}
          sx={BUTTON_SX}
          data-testid={action['data-testid']}
        >
          <Icon icon={action.icon} size={16} aria-hidden="true" />
          {action.label}
        </ButtonBase>
      )}
    </Box>
  )
}
