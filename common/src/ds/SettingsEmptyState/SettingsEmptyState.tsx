// Upstream to twake-ui: no. The empty lists of the settings ("No Rules
// Configured"): twake-mui's `Empty` (icon, title as an `h2`, what to do) and
// an outlined button to start.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Button, Empty } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

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
    <Empty
      icon={<Icon icon={icon} aria-hidden="true" />}
      title={title}
      text={text}
      componentsProps={{ title: { component: 'h2' } }}
      data-testid={testId}
    >
      {action === undefined ? null : (
        <Button
          variant="outlined"
          onClick={action.onClick}
          startIcon={<Icon icon={action.icon} size={16} aria-hidden="true" />}
          sx={{ mt: 3 }}
          data-testid={action['data-testid']}
        >
          {action.label}
        </Button>
      )}
    </Empty>
  )
}
