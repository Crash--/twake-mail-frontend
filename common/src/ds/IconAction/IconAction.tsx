// Upstream to twake-ui: yes, as `IconButton size="small"` with a `label` (the
// tooltip and the accessible name at once) and a 20 px icon. The Twake Mail
// design has 32 px round icon buttons holding a 20 px icon in rows and
// toolbars; twake-mui draws 16 px icons in them. The starred tone is the
// yellow of a filled star, the muted one a faint row icon, darker on hover.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { IconButton, Tooltip } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'

/**
 * The yellow of a filled (favorite) star, in every scheme: twake-mui has no
 * role for it, and `warning` stays for warnings
 */
export const FAVORITE_COLOR = '#FFE082'

const TONE_SX = {
  default: {},
  starred: { color: FAVORITE_COLOR },
  muted: { color: 'text.disabled', '&:hover': { color: 'text.icon' } },
  icon: { color: 'text.icon' },
  primary: { color: 'text.primary' },
  secondary: { color: 'text.secondary' },
  // What cannot be undone
  danger: { color: 'error.main' }
} as const

export interface IconActionProps {
  /** Tooltip and accessible name */
  label: string
  icon: IconProps['icon']
  /** Icon size in px, 20 by default */
  iconSize?: number
  /**
   * `starred`: the yellow of a filled star; `muted`: a faint row icon; `icon`:
   * the icon colour of the theme; `primary`: the primary text colour;
   * `secondary`: the secondary text colour; `danger`: the red of what cannot
   * be undone
   */
  tone?:
    | 'default'
    | 'starred'
    | 'muted'
    | 'icon'
    | 'primary'
    | 'secondary'
    | 'danger'
  /** Width and height of the button in px, 32 by default */
  size?: number
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
      ...TONE_SX[tone]
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
