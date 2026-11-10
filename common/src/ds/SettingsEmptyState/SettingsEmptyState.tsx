// Upstream to twake-ui: no. The empty lists of the settings ("No Rules
// Configured"): twake-mui's `Empty` (icon, title as an `h2`, what to do) and
// a button to start.
import { Box, Button, Empty } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { Icon, type IconProps } from '@/ds/Icon/Icon'

// TODO: drop once twake-mui's `Empty` has these looks
// (https://github.com/Crash--/twake-ui/issues/25): the illustrations of the
// Teammail 1.1 settings, a 60 px icon on a 100 px tile or in the light
// primary colour, instead of the 128 px glyph `Empty` draws (its
// `.Empty-icon` height is overridden, hence the doubled class)
const ILLUSTRATION_ICON_SIZE = 60
const TILE_SX = {
  '&&': {
    height: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  width: 100,
  // Rounder than the radius scale (12 px at most), as the Figma
  borderRadius: '24px',
  bgcolor: 'background.contrast',
  color: 'background.paper'
} as const
const TINTED_SX = {
  '&&': {
    height: ILLUSTRATION_ICON_SIZE,
    display: 'flex',
    justifyContent: 'center'
  },
  color: 'primary.light'
} as const
// twake-icons has no single forward arrow: the reply one, the other way
const MIRRORED_SX = { transform: 'scaleX(-1)' } as const

export interface SettingsEmptyStateProps {
  icon: IconProps['icon']
  /**
   * `plain`: the icon of twake-mui's `Empty`; `tile`: in white on a grey
   * tile; `tinted`: in the light primary colour
   */
  look?: 'plain' | 'tile' | 'tinted'
  /** The icon drawn the other way round, e.g. a reply arrow forwarding */
  isIconMirrored?: boolean
  title: string
  text: string
  /** The button starting the list, e.g. "Create your first rule" */
  action?: {
    label: string
    icon: IconProps['icon']
    onClick: () => void
    'data-testid'?: string
  }
  'data-testid'?: string
}

function Illustration({
  icon,
  look,
  isMirrored,
  className
}: {
  icon: IconProps['icon']
  look: 'tile' | 'tinted'
  isMirrored: boolean
  /** `Empty` gives its icon class */
  className?: string
}): ReactElement {
  const glyph = (
    <Box
      component="span"
      className="u-flex"
      sx={isMirrored ? MIRRORED_SX : undefined}
    >
      <Icon icon={icon} size={ILLUSTRATION_ICON_SIZE} aria-hidden="true" />
    </Box>
  )
  return (
    <Box
      className={className}
      sx={look === 'tile' ? TILE_SX : TINTED_SX}
      aria-hidden="true"
    >
      {glyph}
    </Box>
  )
}

/** What an empty list of the settings shows */
export function SettingsEmptyState({
  icon,
  look = 'plain',
  isIconMirrored = false,
  title,
  text,
  action,
  'data-testid': testId
}: SettingsEmptyStateProps): ReactElement {
  return (
    <Empty
      icon={
        look === 'plain' ? (
          <Icon icon={icon} aria-hidden="true" />
        ) : (
          <Illustration icon={icon} look={look} isMirrored={isIconMirrored} />
        )
      }
      title={title}
      text={text}
      componentsProps={{ title: { component: 'h2' } }}
      data-testid={testId}
    >
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
    </Empty>
  )
}
