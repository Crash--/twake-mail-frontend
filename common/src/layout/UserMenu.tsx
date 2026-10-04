import { Icon, Logout } from '@linagora/twake-icons'
import {
  Avatar,
  Divider,
  getInitials,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip
} from '@linagora/twake-mui'
import { useId, useState, type MouseEvent, type ReactElement } from 'react'

import {
  useAuthService,
  useAuthState
} from '@common/features/auth/AuthProvider'
import { useI18n } from '@common/i18n/useI18n'

/**
 * Avatar of the signed-in user, opening the account menu.
 */
export function UserMenu(): ReactElement {
  const { t } = useI18n()
  const menuId = useId()
  const service = useAuthService()
  const state = useAuthState()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  const user =
    state.status === 'authenticated' ? state.user : { email: null, name: null }
  const displayName = user.name ?? user.email ?? ''

  const handleOpen = (event: MouseEvent<HTMLElement>): void => {
    setAnchor(event.currentTarget)
  }

  const handleClose = (): void => {
    setAnchor(null)
  }

  const handleLogout = (): void => {
    setAnchor(null)
    service.logout().catch((error: unknown) => {
      console.error('[auth] Logout failed', error)
    })
  }

  return (
    <>
      <Tooltip title={t('topbar.account')}>
        <IconButton
          aria-label={t('topbar.account')}
          aria-controls={anchor ? menuId : undefined}
          aria-haspopup="true"
          aria-expanded={anchor ? 'true' : undefined}
          onClick={handleOpen}
          data-testid="user-avatar"
        >
          <Avatar size="s">
            {getInitials(user.name ?? '', user.email ?? '')}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={anchor !== null}
        onClose={handleClose}
        data-testid="account-menu"
      >
        <ListItem data-testid="user-menu-identity">
          <ListItemText
            primary={displayName}
            secondary={user.name ? user.email : null}
          />
        </ListItem>
        <Divider />
        <MenuItem onClick={handleLogout} data-testid="logout-button">
          <ListItemIcon>
            <Icon icon={Logout} />
          </ListItemIcon>
          <ListItemText primary={t('topbar.logout')} />
        </MenuItem>
      </Menu>
    </>
  )
}
