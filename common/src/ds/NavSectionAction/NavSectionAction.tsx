// Upstream to twake-ui: yes, as a touch size of `IconButton`. The actions of
// the title of a sidebar section: twake-mui's `xsmall` button, 44 px on touch
// screens.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { IconButton, Tooltip } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement, Ref } from 'react'

import { TOUCH_MEDIA, TOUCH_TARGET_SIZE } from '@/ds/TouchTargets/TouchTargets'

export interface NavSectionActionProps {
  /** Tooltip and accessible name */
  label: string
  icon: IconProps['icon']
  /** The glyph, 16 px by default */
  iconSize?: number
  onClick: (event: MouseEvent<HTMLElement>) => void
  buttonRef?: Ref<HTMLButtonElement>
  disabled?: boolean
  'aria-pressed'?: boolean
  'aria-expanded'?: boolean
  'aria-controls'?: string
  'data-testid'?: string
}

/** A dense icon button of a sidebar: search, add, show, refresh */
export function NavSectionAction({
  label,
  icon,
  iconSize = 16,
  onClick,
  buttonRef,
  disabled,
  'aria-pressed': pressed,
  'aria-expanded': expanded,
  'aria-controls': controls,
  'data-testid': testId
}: NavSectionActionProps): ReactElement {
  return (
    <Tooltip title={label}>
      <IconButton
        ref={buttonRef}
        size="xsmall"
        aria-label={label}
        aria-pressed={pressed}
        aria-expanded={expanded}
        aria-controls={controls}
        disabled={disabled}
        onClick={onClick}
        data-testid={testId}
        sx={{
          [TOUCH_MEDIA]: {
            width: TOUCH_TARGET_SIZE,
            height: TOUCH_TARGET_SIZE,
            minWidth: TOUCH_TARGET_SIZE,
            minHeight: TOUCH_TARGET_SIZE
          }
        }}
      >
        <Icon icon={icon} size={iconSize} />
      </IconButton>
    </Tooltip>
  )
}
