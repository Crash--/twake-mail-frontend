// Upstream to twake-ui: yes, as a `size` of `Button`. twake-mui forces 16 px
// text on every `Button`; the Twake Mail design has "button medium" at 14 / 20
// with letter spacing 0.1, a fixed width and an 18 px icon
// (docs/twake-mui-gaps.md).
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
 * The main action of a form (Send): filled primary, pill radius, 40 px high
 * at least, an 18 px icon then a 14 px medium label.
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
        minWidth: isIconOnly ? 44 : undefined,
        minHeight: isIconOnly ? 44 : 40,
        height: isIconOnly ? 44 : undefined,
        // The disc is the padding box, the transparent border widens the target
        ...(isIconOnly
          ? {
              p: 0,
              border: '6px solid transparent',
              backgroundClip: 'padding-box',
              boxSizing: 'border-box'
            }
          : { py: '10px', px: 3 }),
        gap: '10px',
        borderRadius: '100px',
        fontSize: 14,
        fontWeight: 500,
        lineHeight: '20px',
        letterSpacing: '0.1px',
        textTransform: 'none',
        '& .MuiButton-startIcon': { m: 0 }
      }}
    >
      {isIconOnly ? <Icon icon={icon} size={18} aria-hidden="true" /> : label}
    </Button>
  )
}
