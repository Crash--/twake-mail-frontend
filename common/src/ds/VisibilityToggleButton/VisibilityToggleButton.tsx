// Upstream to twake-ui: no. The "Visible" / "Hidden" button (Settings >
// Folder visibility), as the Figma: a 24 px pill on `primary.light`, its
// 16 px icon before the state it shows, `caption` in `primary.main`.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

const BUTTON_SX = {
  flexShrink: 0,
  minWidth: 0,
  minHeight: 24,
  px: 1,
  py: 0,
  gap: '4px',
  borderRadius: '12px',
  bgcolor: 'primary.light',
  color: 'primary.main',
  typography: 'caption',
  '&:hover': { bgcolor: 'primary.light', filter: 'brightness(0.96)' },
  '& .MuiButton-startIcon': { m: 0 }
} as const

export interface VisibilityToggleButtonProps {
  /** The visible state, e.g. "Visible" */
  text: string
  /** The accessible name, starting with the state, e.g. "Visible: Hide Projects" */
  label: string
  icon: IconProps['icon']
  onClick: () => void
  'data-testid'?: string
}

/** A small pill showing a state, that switches it */
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
      size="small"
      disableRipple
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
