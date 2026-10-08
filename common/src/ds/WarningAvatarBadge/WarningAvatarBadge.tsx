// Upstream to twake-ui: yes, as a `color`/`icon` variant of `Avatar`:
// twake-mui's `Avatar` shows initials or a picture, not a state. See
// docs/twake-mui-gaps.md "Message alerts".
import { Icon } from '@linagora/twake-icons'
import { Avatar, type AvatarProps } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { WarningCircle } from '@/ds/FlutterIcons/FlutterIcons'

export interface WarningAvatarBadgeProps {
  /** What it says, e.g. "Dangerous message": it replaces the sender avatar */
  label: string
  size?: AvatarProps['size']
  /** `span` inside phrasing content, e.g. the button toggling a message */
  component?: 'div' | 'span'
  'data-testid'?: string
}

/**
 * A red round badge with a warning sign, in place of the avatar of a sender
 * whose message is flagged dangerous. An image named by `label`, so that
 * the state is not carried by its colour.
 */
export function WarningAvatarBadge({
  label,
  size,
  component = 'div',
  'data-testid': testId
}: WarningAvatarBadgeProps): ReactElement {
  return (
    <Avatar
      component={component}
      size={size}
      role="img"
      aria-label={label}
      data-testid={testId}
      sx={theme => ({
        bgcolor: theme.palette.error.main,
        color: theme.palette.error.contrastText
      })}
    >
      <Icon icon={WarningCircle} />
    </Avatar>
  )
}
