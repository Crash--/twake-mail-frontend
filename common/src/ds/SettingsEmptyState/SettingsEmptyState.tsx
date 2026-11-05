// Upstream to twake-ui: no. The empty lists of the settings ("No Rules
// Configured"), as the Figma's: a 100 px tile on `background.contrast` with
// its white glyph, 40 px above the title (`h3`, an `h2` of the page) and
// what to do (`body1`), then a button to start. twake-mui's `Empty` has
// neither the tile nor these sizes.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Box, Button, Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

const ROOT_SX = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  maxWidth: 506,
  mx: 'auto',
  mt: 16,
  textAlign: 'center',
  color: 'text.primary'
} as const

const TILE_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 100,
  height: 100,
  mb: 5,
  borderRadius: '33px',
  bgcolor: 'background.contrast',
  color: 'common.white'
} as const

const TITLE_SX = { m: 0, typography: 'h3' } as const

const TEXT_SX = { mt: 1, mb: 0, typography: 'body1' } as const

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
      <Box sx={TILE_SX}>
        <Icon icon={icon} size={62} aria-hidden="true" />
      </Box>
      <Typography component="h2" sx={TITLE_SX}>
        {title}
      </Typography>
      <Typography component="p" sx={TEXT_SX}>
        {text}
      </Typography>
      {action === undefined ? null : (
        <Button
          className="u-mt-1-half"
          onClick={action.onClick}
          startIcon={<Icon icon={action.icon} size={12} aria-hidden="true" />}
          data-testid={action['data-testid']}
        >
          {action.label}
        </Button>
      )}
    </Box>
  )
}
