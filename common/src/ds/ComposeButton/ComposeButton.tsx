// Upstream to twake-ui: yes, as a `size`/`shape` variant of `Button`.
// twake-mui forces a pill radius (100 px), 16 px text and a 40 px height on
// every `Button`; the Twake Mail design has a 12 px radius and 14 px text
// (docs/twake-mui-gaps.md). The accent is the AA one (`navColors`).
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { NAV_ACCENT, NAV_ACCENT_HOVER } from '@/ds/navColors/navColors'
import { TOUCH_MEDIA, TOUCH_TARGET_SIZE } from '@/ds/TouchTargets/TouchTargets'

export interface ComposeButtonProps {
  label: string
  icon: IconProps['icon']
  onClick: () => void
  'data-testid'?: string
}

/**
 * The main action of a sidebar: a full width button, 12 px radius, 14 px
 * medium label and a 12 px icon, white on an AA blue.
 */
export function ComposeButton({
  label,
  icon,
  onClick,
  'data-testid': testId
}: ComposeButtonProps): ReactElement {
  return (
    <Button
      variant="contained"
      fullWidth
      onClick={onClick}
      startIcon={<Icon icon={icon} size={12} />}
      data-testid={testId}
      sx={{
        minHeight: 39,
        py: '10.5px',
        px: 2,
        borderRadius: '12px',
        backgroundColor: NAV_ACCENT,
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 500,
        lineHeight: '18.4px',
        letterSpacing: 0.25,
        textTransform: 'none',
        boxShadow: 'none',
        '&:hover, &:active': {
          backgroundColor: NAV_ACCENT_HOVER,
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
