// Upstream to twake-ui: yes, as a `size`/`shape` variant of `Button`.
// twake-mui forces a pill radius (100 px), 16 px text and a 40 px height on
// every `Button`; the Twake Mail design has a 12 px radius and 14 px text
// (docs/twake-mui-gaps.md).
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { TOUCH_MEDIA, TOUCH_TARGET_SIZE } from '@/ds/TouchTargets/TouchTargets'

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

/**
 * The main action of a sidebar or a toolbar: a button, 12 px radius, 14 px
 * medium label and a 12 px icon, white on the primary colour.
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
          : { minHeight: 39, py: '10.5px' }),
        px: 2,
        borderRadius: '12px',
        fontSize: 14,
        fontWeight: 500,
        lineHeight: '18.4px',
        letterSpacing: 0.25,
        textTransform: 'none',
        boxShadow: 'none',
        '&:hover, &:active': {
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
