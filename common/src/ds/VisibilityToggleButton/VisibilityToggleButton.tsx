// Upstream to twake-ui: no. The "Hide" / "Show" button (Settings > Folder
// visibility): a small primary text button with its icon after the text.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

const BUTTON_SX = { flexShrink: 0 } as const

export interface VisibilityToggleButtonProps {
  /** The visible text, e.g. "Hide" */
  text: string
  /** The accessible name, e.g. "Hide Projects" */
  label: string
  icon: IconProps['icon']
  onClick: () => void
  'data-testid'?: string
}

/** A small primary text button with its icon after the text */
export function VisibilityToggleButton({
  text,
  label,
  icon,
  onClick,
  'data-testid': testId
}: VisibilityToggleButtonProps): ReactElement {
  return (
    <Button
      variant="text"
      color="primary"
      size="small"
      endIcon={<Icon icon={icon} size={20} />}
      aria-label={label}
      onClick={onClick}
      sx={BUTTON_SX}
      data-testid={testId}
    >
      {text}
    </Button>
  )
}
