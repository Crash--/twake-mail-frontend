import { Bottom, Check, Icon } from '@linagora/twake-icons'
import { Chip } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'

export interface FilterChipProps {
  label: string
  /** Applied: a check mark and `aria-pressed`, not only a colour */
  isSelected: boolean
  onClick: (event: MouseEvent<HTMLElement>) => void
  /** Opens a menu of values rather than toggling */
  hasMenu?: boolean
  /** The chip of a menu, while it is open */
  isExpanded?: boolean
  /** Keeps the focus where it is (the search field) when clicked */
  keepFocus?: boolean
  'data-testid'?: string
}

function preventFocus(event: MouseEvent<HTMLElement>): void {
  event.preventDefault()
}

/**
 * A search filter: a toggle (`aria-pressed`), or a button opening the menu
 * of its values (`aria-haspopup`).
 */
export function FilterChip({
  label,
  isSelected,
  onClick,
  hasMenu = false,
  isExpanded = false,
  keepFocus = false,
  'data-testid': testId
}: FilterChipProps): ReactElement {
  const menuProps = hasMenu
    ? { 'aria-haspopup': 'menu' as const, 'aria-expanded': isExpanded }
    : { 'aria-pressed': isSelected }
  return (
    <Chip
      label={label}
      clickable
      color={isSelected ? 'primary' : 'default'}
      variant={isSelected ? 'filled' : 'outlined'}
      icon={isSelected ? <Icon icon={Check} /> : undefined}
      endIcon={hasMenu ? <Icon icon={Bottom} /> : undefined}
      onClick={onClick}
      onMouseDown={keepFocus ? preventFocus : undefined}
      {...menuProps}
      data-selected={isSelected ? 'true' : undefined}
      data-testid={testId}
    />
  )
}
