// Upstream to twake-ui: yes, as `IconButton size="small"` with a `label` (the
// tooltip and the accessible name at once) and a 20 px icon. The Twake Mail
// design has 32 px round icon buttons holding a 20 px icon in rows and
// toolbars; twake-mui draws 16 px icons in them. The starred tone is the
// yellow star of tmail-flutter, the muted one its grey row icons
// (`steelGray200`, darker on hover).
import { Icon, type IconProps } from '@linagora/twake-icons'
import { IconButton, Tooltip } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'

const TONE_SX = {
  default: {},
  starred: { color: '#FFCC00' },
  muted: { color: '#AEB7C2', '&:hover': { color: '#55687D' } },
  // The refresh of tmail-flutter: a blue icon on a light grey square
  filled: {
    color: 'primary.main',
    borderRadius: '10px',
    bgcolor: 'rgba(235, 237, 240, 0.6)',
    '&:hover': { bgcolor: 'rgba(235, 237, 240, 1)' }
  }
} as const

export interface IconActionProps {
  /** Tooltip and accessible name */
  label: string
  icon: IconProps['icon']
  /** Icon size in px, 20 by default */
  iconSize?: number
  /**
   * `starred`: the yellow of a filled star; `muted`: the light grey of the
   * row icons of tmail-flutter; `filled`: a primary icon on a light grey
   * rounded square (the toolbar buttons of tmail-flutter)
   */
  tone?: 'default' | 'starred' | 'muted' | 'filled'
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
  // A disabled button takes no pointer event, so the tooltip needs a wrapper
  return (
    <Tooltip title={label}>
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
