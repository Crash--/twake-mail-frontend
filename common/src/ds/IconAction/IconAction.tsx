// Upstream to twake-ui: yes, as `IconButton size="small"` with a `label` (the
// tooltip and the accessible name at once) and a 20 px icon. The Twake Mail
// design has 32 px round icon buttons holding a 20 px icon in rows and
// toolbars; twake-mui draws 16 px icons in them. The starred tone is the
// yellow of a filled star, the muted one a faint row icon, darker on hover.
import { IconButton, Tooltip } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'

import { Icon, type IconProps } from '@/ds/Icon/Icon'
import { TOUCH_MEDIA, TOUCH_TARGET_SIZE } from '@/ds/TouchTargets/TouchTargets'

/**
 * The yellow of a filled (favorite) star, in every scheme: twake-mui has no
 * role for it, and `warning` stays for warnings
 */
export const FAVORITE_COLOR = '#FFCA28'

const TONE_SX = {
  default: {},
  starred: { color: FAVORITE_COLOR },
  muted: { color: 'text.disabled', '&:hover': { color: 'text.icon' } },
  icon: { color: 'text.icon' },
  secondary: { color: 'text.secondary' },
  // What cannot be undone
  danger: { color: 'error.main' }
} as const

/** The space before an inline button, its target never overflows past it */
const INLINE_GAP = 4

/**
 * The touch target of an inline button: 44 px high, wider after the button
 * than before it, so that a tap at the end of the text before still hits
 * the text (an 18 px button gets a 35 × 44 target). The icon stays where a
 * mouse sees it, close to the text, not centred in the wider target
 */
function inlineTouchTarget(
  size: number,
  iconSize: number
): { minWidth: number; m: string; justifyContent: string; pl: string } {
  const overflow = (TOUCH_TARGET_SIZE - size) / 2
  return {
    minWidth: size + INLINE_GAP + overflow,
    m: `-${overflow}px -${overflow}px -${overflow}px -${INLINE_GAP}px`,
    justifyContent: 'flex-start',
    pl: `${INLINE_GAP + (size - iconSize) / 2}px`
  }
}

export interface IconActionProps {
  /** Tooltip and accessible name */
  label: string
  icon: IconProps['icon']
  /** Icon size in px, 20 by default */
  iconSize?: number
  /**
   * `starred`: the yellow of a filled star; `muted`: a faint row icon; `icon`:
   * the icon colour of the theme; `secondary`: the secondary text colour;
   * `danger`: the red of what cannot be undone
   */
  tone?: 'default' | 'starred' | 'muted' | 'icon' | 'secondary' | 'danger'
  /** Width and height of the button in px, 32 by default */
  size?: number
  /**
   * After a text, on its line: on touch screens its target, 44 px high,
   * overflows the button drawn above, below and after it, so that the line
   * keeps its height, and by `INLINE_GAP` only before it, not over the text
   */
  isInline?: boolean
  onClick?: (event: MouseEvent<HTMLElement>) => void
  'aria-pressed'?: boolean
  'aria-haspopup'?: 'menu'
  'aria-expanded'?: boolean
  disabled?: boolean
  'data-testid'?: string
}

/**
 * A 32 px round icon button with its tooltip, the way rows and toolbars of
 * the list draw their actions.
 */
export function IconAction({
  label,
  icon,
  iconSize = 20,
  tone = 'default',
  size = 32,
  isInline = false,
  onClick,
  disabled,
  'aria-pressed': pressed,
  'aria-haspopup': hasPopup,
  'aria-expanded': expanded,
  'data-testid': testId
}: IconActionProps): ReactElement {
  const content = <Icon icon={icon} size={iconSize} />
  const common = {
    size: 'small',
    'aria-label': label,
    'aria-pressed': pressed,
    'aria-haspopup': hasPopup,
    'aria-expanded': expanded,
    'data-testid': testId,
    onClick,
    disabled,
    sx: {
      width: size,
      height: size,
      p: 0,
      ...TONE_SX[tone],
      ...(isInline && size < TOUCH_TARGET_SIZE
        ? { [TOUCH_MEDIA]: inlineTouchTarget(size, iconSize) }
        : {})
    }
  } as const
  // A disabled button takes no pointer event, so the tooltip needs a wrapper.
  // Click-through: the tooltip only repeats the name, and an interactive one
  // covered the action of the next row and swallowed its click
  return (
    <Tooltip title={label} disableInteractive>
      {disabled ? (
        <span>
          <IconButton {...common}>{content}</IconButton>
        </span>
      ) : (
        <IconButton {...common}>{content}</IconButton>
      )}
    </Tooltip>
  )
}
