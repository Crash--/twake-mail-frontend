// Upstream to twake-ui: yes. The search filters of the Figma "Teammail 1.1"
// file are flat chips (#f3f6f9, no border, 8 px radius) with a 16 px icon,
// an optional chevron, and a pale primary look with a cross once applied.
// twake-mui's `Chip` is outlined or filled with a solid primary colour, and
// needs `sx` for that background (docs/twake-mui-gaps.md).
import { Bottom, CrossSmall, Icon, type IconProps } from '@linagora/twake-icons'
import { Chip, type SxProps, type Theme } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'

const CHIP_SX = (isSelected: boolean): SxProps<Theme> => ({
  height: 32,
  borderRadius: 2,
  border: 0,
  px: 0.5,
  fontSize: 14,
  fontWeight: 500,
  color: isSelected ? 'primary.main' : 'text.primary',
  bgcolor: theme =>
    isSelected
      ? `color-mix(in srgb, ${theme.palette.primary.main} 12%, transparent)`
      : theme.palette.background.default,
  '&:hover, &.Mui-focusVisible': {
    bgcolor: theme =>
      isSelected
        ? `color-mix(in srgb, ${theme.palette.primary.main} 20%, transparent)`
        : theme.palette.action.hover
  },
  '& .MuiChip-icon': {
    ml: 1,
    mr: 0,
    fontSize: 16,
    color: isSelected ? 'primary.main' : 'text.secondary'
  },
  '& .MuiChip-label': { px: 1 }
})

export interface FilterChipProps {
  label: string
  /** The icon before the label */
  icon?: IconProps['icon']
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
  return (
    <Chip
      label={label}
      clickable
      variant="filled"
      icon={icon === undefined ? undefined : <Icon icon={icon} />}
      endIcon={
        popup !== undefined ? (
          <Icon icon={Bottom} size={12} />
        ) : isSelected ? (
          <Icon icon={CrossSmall} />
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
