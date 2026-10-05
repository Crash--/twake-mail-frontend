// Upstream to twake-ui: yes, as `IconButton size="small"` with a `label` (the
// tooltip and the accessible name at once) and a 20 px icon. The Twake Mail
// design has 32 px round icon buttons holding a 20 px icon in rows and
// toolbars; twake-mui draws 16 px icons in them. The starred tone is the
// yellow star of the list (Warning 200).
import { Icon, type IconProps } from '@linagora/twake-icons'
import { IconButton, Tooltip } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'

export interface IconActionProps {
  /** Tooltip and accessible name */
  label: string
  icon: IconProps['icon']
  /** Icon size in px, 20 by default */
  iconSize?: number
  /** `starred`: the yellow of a filled star */
  tone?: 'default' | 'starred'
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
      width: 32,
      height: 32,
      p: 0,
      ...(tone === 'starred' ? { color: 'warning.light' } : {})
    }
  } as const
  return (
    <Tooltip title={label}>
      <IconButton {...common}>{content}</IconButton>
    </Tooltip>
  )
}
