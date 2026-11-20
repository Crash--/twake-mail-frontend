// Upstream to twake-ui: yes. The search filters are twake-mui's filled
// `square` `Chip` (32 px, `action.selected`), with an optional chevron after
// the label, and the pale primary colour with a small cross once applied.
// twake-mui's `Chip` has no applied state short of a solid primary colour,
// and needs `sx` for that tint (docs/twake-mui-gaps.md).
import { Dropdown, Cross } from '@linagora/twake-icons'
import { Box, Chip, type SxProps, type Theme } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'

import { Icon, type IconProps } from '@/ds/Icon/Icon'

/** The slot of the icons in Teammail 1.1's "Chip filters", in px */
const SLOT = 16
/**
 * The chevron: twake-icons draw edge to edge, Material keeps a margin, so
 * a 12 px box looks the size of the mockup's, centred in its 16 px slot
 */
const CHEVRON_SIZE = 12
/** The check of an applied filter, the same in every chip */
const SELECTED_ICON_SIZE = 14
const END_SX = {
  display: 'flex',
  color: 'text.secondary',
  px: `${(SLOT - CHEVRON_SIZE) / 2}px`
} as const
/** The cross of an applied filter takes its primary colour */
const CROSS_SX = { display: 'flex' } as const

/**
 * The metrics of Teammail 1.1's "Chip filters" (twake-mui's `Chip` keeps
 * MUI's): 12 px before the 16 px slot of the icon, which centres it, 4 px
 * between the slot, the `caption` label and the chevron, 8 px after the
 * chevron (12 px without one)
 */
const CHIP_SX = (
  isSelected: boolean,
  hasEnd: boolean,
  iconSize: number
): SxProps<Theme> => ({
  '& .MuiChip-icon': {
    color: isSelected ? 'primary.main' : 'text.secondary',
    // Whole pixels, so that the icon stays sharp: the odd pixel goes after
    // it, the label stays in place
    ml: `${12 + Math.floor((SLOT - iconSize) / 2)}px`,
    mr: `${-8 + Math.ceil((SLOT - iconSize) / 2)}px`
  },
  '& .MuiChip-label': { typography: 'caption', pr: hasEnd ? '8px' : '12px' },
  '& .MuiChip-label > span': { gap: '4px' },
  ...(isSelected
    ? {
        color: 'primary.main',
        bgcolor: (theme: Theme) =>
          `color-mix(in srgb, ${theme.vars.palette.primary.main} 8%, transparent)`,
        '&:hover, &.Mui-focusVisible': {
          bgcolor: (theme: Theme) =>
            `color-mix(in srgb, ${theme.vars.palette.primary.main} 16%, transparent)`
        }
      }
    : {})
})

export interface FilterChipProps {
  label: string
  /** The icon before the label */
  icon?: IconProps['icon']
  /**
   * Its box, 16 px by default, centred in the 16 px slot: the size at which
   * the twake-icons glyph looks as big as the mockup's
   */
  iconSize?: number
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
  iconSize = SLOT,
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
  const isSelectedIconShown = isSelected && selectedIcon !== undefined
  const leadingIcon = isSelectedIconShown ? selectedIcon : icon
  const leadingSize = isSelectedIconShown ? SELECTED_ICON_SIZE : iconSize
  return (
    <Chip
      label={label}
      clickable
      variant="filled"
      square
      icon={
        leadingIcon === undefined ? undefined : (
          <Icon icon={leadingIcon} size={leadingSize} />
        )
      }
      endIcon={
        popup !== undefined ? (
          <Box component="span" sx={END_SX}>
            <Icon icon={Dropdown} size={CHEVRON_SIZE} />
          </Box>
        ) : isSelected ? (
          <Box component="span" sx={CROSS_SX}>
            <Icon icon={Cross} size={10} />
          </Box>
        ) : undefined
      }
      sx={CHIP_SX(isSelected, popup !== undefined || isSelected, leadingSize)}
      onClick={onClick}
      onMouseDown={keepFocus ? preventFocus : undefined}
      {...stateProps}
      aria-label={ariaLabel}
      data-selected={isSelected ? 'true' : undefined}
      data-testid={testId}
    />
  )
}
