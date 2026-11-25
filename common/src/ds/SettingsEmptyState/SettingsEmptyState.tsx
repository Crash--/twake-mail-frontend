// Upstream to twake-ui: no. The empty lists of the settings ("No Rules
// Configured"): twake-mui's `Empty` (icon, title as an `h2`, what to do) and
// a button to start.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Button, Empty } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

/** The icon of the tinted look, as the Teammail 1.1 forwarding settings */
const TINTED_ICON = {
  size: 60,
  color: 'var(--twake-palette-primary-light)'
} as const

export interface SettingsEmptyStateProps {
  icon: IconProps['icon']
  /**
   * `plain`: the icon of twake-mui's `Empty`; `tile`: the tile look of
   * `Empty`, in white on a grey tile; `tinted`: a 60 px icon in the light
   * primary colour
   */
  look?: 'plain' | 'tile' | 'tinted'
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

/** What an empty list of the settings shows */
export function SettingsEmptyState({
  icon,
  look = 'plain',
  title,
  text,
  action,
  'data-testid': testId
}: SettingsEmptyStateProps): ReactElement {
  return (
    <Empty
      icon={icon}
      iconLook={look === 'tile' ? 'tile' : 'plain'}
      title={title}
      text={text}
      componentsProps={{
        icon: {
          'aria-hidden': true,
          ...(look === 'tinted' ? TINTED_ICON : {})
        },
        title: { component: 'h2' }
      }}
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
