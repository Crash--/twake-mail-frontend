// Upstream to twake-ui: no. The "Visible" / "Hidden" button (Settings >
// Folder visibility): twake-mui's extra small primary ghost button, its icon
// before the state it shows.
import { Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { Icon, type IconProps } from '@/ds/Icon/Icon'

const BUTTON_SX = { flexShrink: 0 } as const

export interface VisibilityToggleButtonProps {
  /** The visible state, e.g. "Visible" */
  text: string
  /** The accessible name, starting with the state, e.g. "Visible: Hide Projects" */
  label: string
  icon: IconProps['icon']
  onClick: () => void
  'data-testid'?: string
}

/** A small button showing a state, that switches it */
export function VisibilityToggleButton({
  text,
  label,
  icon,
  onClick,
  'data-testid': testId
}: VisibilityToggleButtonProps): ReactElement {
  return (
    <Button
      variant="ghost"
      color="primary"
      size="xsmall"
      startIcon={<Icon icon={icon} size={16} />}
      aria-label={label}
      onClick={onClick}
      sx={BUTTON_SX}
      data-testid={testId}
    >
      {text}
    </Button>
  )
}
