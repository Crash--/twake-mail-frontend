// Upstream to twake-ui: no, twake-mui's text Button with a menu chevron and a
// width cap; a `DropdownButton` would bring its own text layout and aria
// (docs/twake-mui-gaps.md).
import { Bottom } from '@linagora/twake-icons'
import { Box, Button, Tooltip } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement, Ref } from 'react'

import { Icon, type IconProps } from '@/ds/Icon/Icon'

const CHEVRON_BOX_SX = { width: 16, height: 16 } as const
// `Bottom` draws 10 x 6.2 px at 16: at 12.8 it is the Figma's
// keyboard_arrow_down, 8 x 4.94 px, 4 px from the sides of its 16 px box
const CHEVRON_SIZE = 12.8

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

/** A text button of a list toolbar: 16 px icon, label, optional chevron. */
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
      endIcon={
        hasMenu ? (
          <Box
            component="span"
            className="u-flex u-flex-items-center u-flex-justify-center"
            sx={CHEVRON_BOX_SX}
          >
            <Icon icon={Bottom} size={CHEVRON_SIZE} />
          </Box>
        ) : undefined
      }
      aria-haspopup={hasPopup}
      aria-controls={controls}
      aria-expanded={expanded}
      data-testid={testId}
      sx={{
        minHeight: 32,
        minWidth: 0,
        maxWidth: 250,
        py: 0,
        px: '6px',
        gap: 1,
        whiteSpace: 'nowrap',
        // A label longer than 250 px (French) is cut with an ellipsis rather
        // than spilling over the buttons around
        justifyContent: 'flex-start',
        overflow: 'hidden',
        flexShrink: 0,
        '& .MuiButton-startIcon, & .MuiButton-endIcon': { m: 0 },
        ...(isActive ? {} : { color: 'text.primary' })
      }}
    >
      <Box
        component="span"
        sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {label}
      </Box>
    </Button>
  )
  return tooltip === undefined || disabled ? (
    button
  ) : (
    <Tooltip title={tooltip}>{button}</Tooltip>
  )
}
