// Upstream to twake-ui: yes. The search filters of tmail-flutter
// (`SearchFilterButton`) are flat chips (#ECEEF1, no border, a 10 px radius,
// 12 px on the sides) with a 16 px icon 4 px before Inter Regular 13 in dark
// grey (#686E76), an optional grey chevron 8 px after it, and the primary
// colour at 6 % (on the background and the icon only) with a 10 px grey
// cross once applied. twake-mui's `Chip` is outlined or filled with a solid primary
// colour, and needs `sx` for that background (docs/twake-mui-gaps.md).
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Box, Chip, type SxProps, type Theme } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'
import { DeleteSelection, Dropdown } from '@/ds/FlutterIcons/FlutterIcons'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

const CHIP_BACKGROUND = TMAIL.fillChip
const CHIP_COLOR = TMAIL.greyDark

/** `AppColor.colorTextBody`: the chevron and the cross */
const END_COLOR = TMAIL.grey

/** icDeleteSelection: 10 px, its 8 px padding taken by the label gap */
const CROSS_SX = { display: 'flex', px: '3px', color: END_COLOR } as const

const CHEVRON_SX = { display: 'flex', color: END_COLOR } as const

const CHIP_SX = (isSelected: boolean): SxProps<Theme> => ({
  height: 34,
  borderRadius: '10px',
  border: 0,
  px: '4px',
  fontSize: 13,
  fontWeight: 400,
  letterSpacing: 0,
  color: CHIP_COLOR,
  bgcolor: theme =>
    isSelected
      ? `color-mix(in srgb, ${theme.vars.palette.primary.main} 6%, transparent)`
      : CHIP_BACKGROUND,
  '&:hover, &.Mui-focusVisible': {
    bgcolor: theme =>
      isSelected
        ? `color-mix(in srgb, ${theme.vars.palette.primary.main} 12%, transparent)`
        : `color-mix(in srgb, ${CHIP_COLOR} 16%, ${CHIP_BACKGROUND})`
  },
  '& .MuiChip-icon': {
    ml: '8px',
    mr: 0,
    fontSize: 16,
    color: isSelected ? 'primary.main' : CHIP_COLOR
  },
  '& .MuiChip-label': { pl: '8px', pr: '8px' },
  '& .MuiChip-icon + .MuiChip-label': { pl: '4px' }
})

export interface FilterChipProps {
  label: string
  /** The icon before the label */
  icon?: IconProps['icon']
  /** Replaces `icon` once applied, e.g. tmail-flutter's blue check */
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
      icon={leadingIcon === undefined ? undefined : <Icon icon={leadingIcon} />}
      endIcon={
        popup !== undefined ? (
          <Box component="span" sx={CHEVRON_SX}>
            <Icon icon={Dropdown} size={16} />
          </Box>
        ) : isSelected ? (
          <Box component="span" sx={CROSS_SX}>
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
