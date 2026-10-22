// Upstream to twake-ui: yes, as a `size`/`shape` variant of `Button`.
// twake-mui forces a pill radius (100 px) on every `Button`; the Twake Mail
// design has a 12 px radius (docs/twake-mui-gaps.md).
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Button, radius } from '@linagora/twake-mui'
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
 * The main action of a sidebar or a toolbar: in a sidebar a full width
 * `Button` of the theme, in a toolbar as wide as its label and 34 px high;
 * 12 px radius and a 12 px icon.
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
          ? { height: 34, minHeight: 34, py: 0, px: 2, whiteSpace: 'nowrap' }
          : {}),
        borderRadius: radius.lg,
        '& .MuiButton-startIcon': { mr: '7px', ml: 0 },
        [TOUCH_MEDIA]: { minHeight: TOUCH_TARGET_SIZE }
      }}
    >
      {label}
    </Button>
  )
}
