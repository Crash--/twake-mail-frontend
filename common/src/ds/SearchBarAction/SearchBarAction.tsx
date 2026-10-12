// Upstream to twake-ui: no, the look of the button at the end of
// tmail-flutter's search bar (`IconOpenAdvancedSearchWidget`): a 22 px
// icon in steel grey (#818C99), primary blue (#0A84FF) while it applies, 4
// px around it, 12 px on its sides, no background. twake-mui's
// `IconButton` sizes and colours it from the theme.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { IconButton, Tooltip } from '@mui/material'
import type { MouseEvent, ReactElement } from 'react'

import { TMAIL } from '@/ds/TmailColors/tmailColors'

function buttonSx(
  isActive: boolean,
  isHidden: boolean
): Record<string, unknown> {
  // Over what the search bar gives its icon buttons
  return {
    '&&&': {
      visibility: isHidden ? 'hidden' : undefined,
      p: '4px',
      mx: '12px',
      borderRadius: '50%',
      color: isActive ? TMAIL.primary0A : TMAIL.grey
    },
    '&&&:hover': { bgcolor: 'rgba(129, 140, 153, 0.12)' }
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
        aria-label={label}
        aria-haspopup={hasPopup}
        onClick={onClick}
        sx={buttonSx(isActive, isHidden)}
        data-active={isActive ? 'true' : undefined}
        data-testid={testId}
      >
        <Icon icon={icon} size={22} />
      </IconButton>
    </Tooltip>
  )
}
