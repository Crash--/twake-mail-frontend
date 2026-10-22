// Upstream to twake-ui: yes, as a round icon-only variant of `Button`, for
// phones, where the footer has no room for the label (docs/twake-mui-gaps.md).
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

export interface PillButtonProps {
  label: string
  icon: IconProps['icon']
  onClick: () => void
  disabled?: boolean
  /** Fixed width, in px; the label sets it when absent */
  width?: number
  /**
   * Only the icon, in a round disc, where the width is short (phones): a
   * 32 px disc in a 44 px touch target; the label stays the accessible name
   */
  isIconOnly?: boolean
  'aria-describedby'?: string
  'data-testid'?: string
}

/**
 * The main action of a form (Send): twake-mui's contained `Button` with an
 * 18 px icon before the label.
 */
export function PillButton({
  label,
  icon,
  onClick,
  disabled = false,
  width,
  isIconOnly = false,
  'aria-describedby': describedBy,
  'data-testid': testId
}: PillButtonProps): ReactElement {
  return (
    <Button
      variant="contained"
      onClick={onClick}
      disabled={disabled}
      aria-describedby={describedBy}
      aria-label={isIconOnly ? label : undefined}
      startIcon={isIconOnly ? undefined : <Icon icon={icon} size={18} />}
      data-testid={testId}
      sx={{
        width: isIconOnly ? 44 : width,
        // The disc is the padding box, the transparent border widens the target
        ...(isIconOnly
          ? {
              minWidth: 44,
              minHeight: 44,
              height: 44,
              p: 0,
              border: '6px solid transparent',
              backgroundClip: 'padding-box',
              boxSizing: 'border-box'
            }
          : {})
      }}
    >
      {isIconOnly ? <Icon icon={icon} size={18} aria-hidden="true" /> : label}
    </Button>
  )
}
