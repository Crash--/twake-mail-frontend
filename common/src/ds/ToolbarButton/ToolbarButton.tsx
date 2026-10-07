// Upstream to twake-ui: yes, as a `size` of `Button variant="text"`. The
// "button medium" of the Twake Mail design is Inter Medium 14 / 20 with a
// 0.1 letter spacing, 32 px high, a 100 px radius and a 16 px icon, in the
// primary text colour; twake-mui draws 16 px text buttons
// (docs/twake-mui-gaps.md).
import { Icon, Dropdown, type IconProps } from '@linagora/twake-icons'
import { Button, Tooltip } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement, Ref } from 'react'

export interface ToolbarButtonProps {
  label: string
  /** A longer name, shown as a tooltip and read as the accessible name */
  tooltip?: string
  icon: IconProps['icon']
  /** Shows a chevron after the label: the button opens a menu */
  hasMenu?: boolean
  /** The primary colour instead of the text colour (a filter is on) */
  isActive?: boolean
  /** Takes no click, and no tooltip (a disabled button gets no pointer event) */
  disabled?: boolean
  onClick: (event: MouseEvent<HTMLElement>) => void
  'aria-haspopup'?: 'menu'
  'aria-controls'?: string
  'aria-expanded'?: boolean
  'data-testid'?: string
  ref?: Ref<HTMLButtonElement>
}

/** A text button of a list toolbar: 16 px icon, 14 px medium label. */
export function ToolbarButton({
  label,
  tooltip,
  icon,
  hasMenu = false,
  isActive = false,
  disabled = false,
  onClick,
  'aria-haspopup': hasPopup,
  'aria-controls': controls,
  'aria-expanded': expanded,
  'data-testid': testId,
  ref
}: ToolbarButtonProps): ReactElement {
  const button = (
    <Button
      ref={ref}
      variant="text"
      color={isActive ? 'primary' : 'inherit'}
      onClick={onClick}
      disabled={disabled}
      startIcon={<Icon icon={icon} size={16} />}
      endIcon={hasMenu ? <Icon icon={Dropdown} size={16} /> : undefined}
      aria-haspopup={hasPopup}
      aria-controls={controls}
      aria-expanded={expanded}
      data-testid={testId}
      sx={{
        minHeight: 32,
        minWidth: 0,
        py: '6px',
        px: '6px',
        gap: 1,
        borderRadius: '100px',
        fontSize: 14,
        fontWeight: 500,
        lineHeight: '20px',
        letterSpacing: '0.1px',
        '& .MuiButton-startIcon, & .MuiButton-endIcon': { m: 0 },
        ...(isActive ? {} : { color: 'text.primary' })
      }}
    >
      {label}
    </Button>
  )
  return tooltip === undefined || disabled ? (
    button
  ) : (
    <Tooltip title={tooltip}>{button}</Tooltip>
  )
}
