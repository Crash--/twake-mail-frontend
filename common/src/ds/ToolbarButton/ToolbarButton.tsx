// Upstream to twake-ui: no, the look of tmail-flutter. The buttons above its
// list ("Select all messages of this page", "Filter messages") are light
// grey (#EBEDF0 at 60 %) rounded rectangles, 34 px high with a 10 px radius,
// a 16 px icon and Inter Regular 13 in dark grey; twake-mui has no such
// button (docs/twake-mui-gaps.md).
import { Icon, Dropdown, type IconProps } from '@linagora/twake-icons'
import { Button, Tooltip } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement, Ref } from 'react'

/** `colorFilterMessageButton` at 60 % on white, its text and icon colour */
export const TOOLBAR_BUTTON_BACKGROUND = 'rgba(235, 237, 240, 0.6)'
const TOOLBAR_BUTTON_HOVER = 'rgba(235, 237, 240, 1)'
const TOOLBAR_BUTTON_COLOR = '#686E76'

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

/** A button of a list toolbar: 16 px icon, 13 px label on light grey. */
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
        height: 34,
        minHeight: 34,
        minWidth: 0,
        maxWidth: 250,
        py: 0,
        px: '12px',
        gap: 1,
        borderRadius: '10px',
        bgcolor: TOOLBAR_BUTTON_BACKGROUND,
        fontSize: 13,
        fontWeight: 400,
        lineHeight: '16px',
        letterSpacing: 0,
        textTransform: 'none',
        whiteSpace: 'nowrap',
        '&:hover': { bgcolor: TOOLBAR_BUTTON_HOVER },
        '& .MuiButton-startIcon, & .MuiButton-endIcon': { m: 0 },
        ...(isActive ? {} : { color: TOOLBAR_BUTTON_COLOR })
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
