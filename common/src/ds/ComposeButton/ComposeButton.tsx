// Upstream to twake-ui: yes, as a `size`/`shape` variant of `Button`.
// twake-mui forces a pill radius (100 px), 16 px text and a 40 px height on
// every `Button`; the Twake Mail design has a 12 px radius and 14 px text
// (docs/twake-mui-gaps.md).
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { TOUCH_MEDIA, TOUCH_TARGET_SIZE } from '@/ds/TouchTargets/TouchTargets'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

export interface ComposeButtonProps {
  label: string
  icon: IconProps['icon']
  onClick: () => void
  /**
   * `sidebar`: the width of its column; `toolbar`: the width of its label
   * and the 34 px of the other controls of the row
   */
  placement?: 'sidebar' | 'toolbar'
  'data-testid'?: string
}

/** White over the button on hover, then on press and focus (tmail-flutter) */
const OVERLAY_HOVER =
  'linear-gradient(rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.08))'
const OVERLAY_PRESSED =
  'linear-gradient(rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.12))'

/**
 * The main action of a sidebar or a toolbar, as tmail-flutter's
 * `LinagoraSidebarPrimaryAction`: in a sidebar a full width button 40 px
 * high, in a toolbar as wide as its label and 34 px high; 12 px radius,
 * 16 px side padding, 14 px medium label and a 12 px icon 7 px before it,
 * white on #0A84FF, lightened by white on hover and press.
 */
export function ComposeButton({
  label,
  icon,
  onClick,
  placement = 'sidebar',
  'data-testid': testId
}: ComposeButtonProps): ReactElement {
  const isInToolbar = placement === 'toolbar'
  return (
    <Button
      variant="contained"
      fullWidth={!isInToolbar}
      onClick={onClick}
      startIcon={<Icon icon={icon} size={12} />}
      data-testid={testId}
      sx={{
        ...(isInToolbar
          ? { height: 34, minHeight: 34, py: 0, whiteSpace: 'nowrap' }
          : { minHeight: 40, py: '8px' }),
        px: 2,
        borderRadius: '12px',
        bgcolor: TMAIL.primary0A,
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 500,
        lineHeight: '18.4px',
        letterSpacing: 0.25,
        textTransform: 'none',
        boxShadow: 'none',
        '&:hover': {
          bgcolor: TMAIL.primary0A,
          backgroundImage: OVERLAY_HOVER,
          boxShadow: 'none'
        },
        '&:active, &.Mui-focusVisible': {
          bgcolor: TMAIL.primary0A,
          backgroundImage: OVERLAY_PRESSED,
          boxShadow: 'none'
        },
        '& .MuiButton-startIcon': { mr: '7px', ml: 0 },
        [TOUCH_MEDIA]: { minHeight: TOUCH_TARGET_SIZE }
      }}
    >
      {label}
    </Button>
  )
}
