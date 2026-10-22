// Upstream to twake-ui: yes. The search filters are twake-mui's filled
// `Chip` (32 px pill, `action.selected`), with an optional chevron after the
// label, and the pale primary colour with a small cross once applied.
// twake-mui's `Chip` has no applied state short of a solid primary colour,
// and needs `sx` for that tint (docs/twake-mui-gaps.md).
import { Icon, type IconProps, Dropdown } from '@linagora/twake-icons'
import { Box, Chip, type SxProps, type Theme } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'
import { DeleteSelection } from '@/ds/FlutterIcons/FlutterIcons'

const END_SX = { display: 'flex', color: 'text.secondary' } as const

const CHIP_SX = (isSelected: boolean): SxProps<Theme> =>
  isSelected
    ? {
        color: 'primary.main',
        bgcolor: theme =>
          `color-mix(in srgb, ${theme.vars.palette.primary.main} 8%, transparent)`,
        '&:hover, &.Mui-focusVisible': {
          bgcolor: theme =>
            `color-mix(in srgb, ${theme.vars.palette.primary.main} 16%, transparent)`
        },
        '& .MuiChip-icon': { color: 'primary.main' }
      }
    : { '& .MuiChip-icon': { color: 'text.secondary' } }

export interface FilterChipProps {
  label: string
  /** The icon before the label */
  icon?: IconProps['icon']
  /** Replaces `icon` once applied, e.g. a check */
  selectedIcon?: IconProps['icon']
  /** Applied: the pale primary look, a cross, and `aria-pressed` */
  isSelected: boolean
  onClick: (event: MouseEvent<HTMLElement>) => void
  /** Opens a popup (a menu of values, a small form) rather than toggling */
  popup?: 'menu' | 'dialog'
  /** Applied and removed on click: a plain button, not a toggle */
  isRemovable?: boolean
  /** The chip of a menu, while it is open */
  isExpanded?: boolean
  /** Keeps the focus where it is (the search field) when clicked */
  keepFocus?: boolean
  /** Replaces the label as the accessible name */
  'aria-label'?: string
  'data-testid'?: string
}

function preventFocus(event: MouseEvent<HTMLElement>): void {
  event.preventDefault()
}

/**
 * A search filter: a toggle (`aria-pressed`), or a button opening the menu
 * of its values (`aria-haspopup`). The cross of an applied toggle is
 * decoration: the whole chip is the one control, and it removes the filter.
 */
export function FilterChip({
  label,
  icon,
  selectedIcon,
  isSelected,
  onClick,
  popup,
  isRemovable = false,
  isExpanded = false,
  keepFocus = false,
  'aria-label': ariaLabel,
  'data-testid': testId
}: FilterChipProps): ReactElement {
  const stateProps =
    popup !== undefined
      ? { 'aria-haspopup': popup, 'aria-expanded': isExpanded }
      : isRemovable
        ? {}
        : { 'aria-pressed': isSelected }
  const leadingIcon =
    isSelected && selectedIcon !== undefined ? selectedIcon : icon
  return (
    <Chip
      label={label}
      clickable
      variant="filled"
      icon={
        leadingIcon === undefined ? undefined : (
          <Icon icon={leadingIcon} size={16} />
        )
      }
      endIcon={
        popup !== undefined ? (
          <Box component="span" sx={END_SX}>
            <Icon icon={Dropdown} size={16} />
          </Box>
        ) : isSelected ? (
          <Box component="span" sx={END_SX}>
            <Icon icon={DeleteSelection} size={10} />
          </Box>
        ) : undefined
      }
      sx={CHIP_SX(isSelected)}
      onClick={onClick}
      onMouseDown={keepFocus ? preventFocus : undefined}
      {...stateProps}
      aria-label={ariaLabel}
      data-selected={isSelected ? 'true' : undefined}
      data-testid={testId}
    />
  )
}
