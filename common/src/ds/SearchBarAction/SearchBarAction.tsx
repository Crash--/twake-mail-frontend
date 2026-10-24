// Upstream to twake-ui: no, an icon button at the end of the search bar:
// twake-mui's small `IconButton`, in primary while what it opens applies.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { IconButton, Tooltip } from '@mui/material'
import type { MouseEvent, ReactElement } from 'react'

function buttonSx(
  isActive: boolean,
  isHidden: boolean
): Record<string, unknown> {
  return {
    visibility: isHidden ? 'hidden' : undefined,
    color: isActive ? 'primary.main' : undefined
  }
}

export interface SearchBarActionProps {
  /** Tooltip and accessible name */
  label: string
  icon: IconProps['icon']
  /** What it opens applies to the search shown: drawn in blue */
  isActive?: boolean
  /**
   * Hidden in place, e.g. while what it opens is open: it stays in the
   * page, so that the focus can come back to it
   */
  isHidden?: boolean
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  'aria-haspopup'?: 'dialog' | 'menu'
  'data-testid'?: string
}

/** An icon button at the end of the search bar, e.g. the advanced search */
export function SearchBarAction({
  label,
  icon,
  isActive = false,
  isHidden = false,
  onClick,
  'aria-haspopup': hasPopup,
  'data-testid': testId
}: SearchBarActionProps): ReactElement {
  return (
    <Tooltip title={label}>
      <IconButton
        size="small"
        aria-label={label}
        aria-haspopup={hasPopup}
        onClick={onClick}
        sx={buttonSx(isActive, isHidden)}
        data-active={isActive ? 'true' : undefined}
        data-testid={testId}
      >
        <Icon icon={icon} />
      </IconButton>
    </Tooltip>
  )
}
