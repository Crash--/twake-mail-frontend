// Upstream to twake-ui: no, the look of tmail-flutter's "Hide" / "Show"
// button (Settings > Folder visibility): a small primary text button, Inter
// Regular 12 / 18, its icon (20 px box, 18 px glyph) 8 px after the text. twake-mui's small
// `Button` is 13 px Medium with its icon before the text.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

const BUTTON_SX = {
  flexShrink: 0,
  minWidth: 0,
  py: '3px',
  px: 1,
  gap: 1,
  fontSize: 12,
  fontWeight: 400,
  lineHeight: '18px',
  letterSpacing: 0,
  textTransform: 'none',
  '& .MuiButton-endIcon': { m: 0 }
} as const

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
      endIcon={<Icon icon={icon} size={18} />}
      aria-label={label}
      onClick={onClick}
      sx={BUTTON_SX}
      data-testid={testId}
    >
      {text}
    </Button>
  )
}
