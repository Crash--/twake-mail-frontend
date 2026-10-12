// Upstream to twake-ui: yes, as an `IconButton` size for dense actions
// (`xsmall` is 26 px and draws a 20 px icon). The actions of the title of a
// sidebar section are 16.67 px glyphs, 8 px apart (tmail-flutter's
// `LinagoraSidebarSectionHeaderAction`); the box around them is 24 px, the
// smallest WCAG 2.2 allows, and 44 px on touch screens, drawn over the gap
// so the glyphs keep their places.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { IconButton, Tooltip } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement, Ref } from 'react'

import { TOUCH_MEDIA, TOUCH_TARGET_SIZE } from '@/ds/TouchTargets/TouchTargets'

export interface NavSectionActionProps {
  /** Tooltip and accessible name */
  label: string
  icon: IconProps['icon']
  /** The glyph, 16.67 px by default */
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
  iconSize = 16.67,
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
        size="small"
        aria-label={label}
        aria-pressed={pressed}
        aria-expanded={expanded}
        aria-controls={controls}
        disabled={disabled}
        onClick={onClick}
        data-testid={testId}
        sx={{
          width: 24,
          height: 24,
          minWidth: 0,
          minHeight: 0,
          p: 0,
          // 16.67 + 8 between two glyphs: the boxes overlap the gap
          '& + &': { ml: '0.67px' },
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
