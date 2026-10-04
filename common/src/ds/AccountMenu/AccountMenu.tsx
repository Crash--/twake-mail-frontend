// Upstream to twake-ui: yes. The avatar menu with the identity of the user
// and "Sign out" is the same in every Twake app; twake-mui has the avatar
// and the menu, not the account menu.
import { Icon, Logout, type IconProps } from '@linagora/twake-icons'
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

export interface AccountMenuTestIds {
  button?: string
  menu?: string
  identity?: string
  logout?: string
}

export interface AccountMenuItem {
  label: string
  icon: IconProps['icon']
  onClick: () => void
  'data-testid'?: string
}

export interface AccountMenuProps {
  /** Display name, null when unknown: the email is shown instead */
  name: string | null
  email: string | null
  /** Name and tooltip of the avatar button, e.g. "My account" */
  label: string
  logoutLabel: string
  onLogout: () => void
  /** More items, between the identity and sign out */
  items?: readonly AccountMenuItem[]
  testIds?: AccountMenuTestIds
}

/**
 * The avatar of the signed-in user, opening a menu with their identity and
 * a sign out item.
 */
export function AccountMenu({
  name,
  email,
  label,
  logoutLabel,
  onLogout,
  items = [],
  testIds = {}
}: AccountMenuProps): ReactElement {
  const menuId = useId()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const displayName = name ?? email ?? ''

  const handleOpen = (event: MouseEvent<HTMLElement>): void => {
    setAnchor(event.currentTarget)
  }

  const handleClose = (): void => {
    setAnchor(null)
  }

  const handleLogout = (): void => {
    setAnchor(null)
    onLogout()
  }

  return (
    <>
      <Tooltip title={label}>
        <IconButton
          aria-label={label}
          aria-controls={anchor ? menuId : undefined}
          aria-haspopup="true"
          aria-expanded={anchor ? 'true' : undefined}
          onClick={handleOpen}
          data-testid={testIds.button}
        >
          <Avatar size="s" aria-hidden="true">
            {getInitials(name ?? '', email ?? '')}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={anchor !== null}
        onClose={handleClose}
        data-testid={testIds.menu}
      >
        <ListItem data-testid={testIds.identity}>
          <ListItemText
            primary={displayName}
            secondary={name !== null ? email : null}
          />
        </ListItem>
        <Divider />
        {items.map(item => (
          <MenuItem
            key={item.label}
            onClick={() => {
              setAnchor(null)
              item.onClick()
            }}
            data-testid={item['data-testid']}
          >
            <ListItemIcon>
              <Icon icon={item.icon} />
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </MenuItem>
        ))}
        <MenuItem onClick={handleLogout} data-testid={testIds.logout}>
          <ListItemIcon>
            <Icon icon={Logout} />
          </ListItemIcon>
          <ListItemText primary={logoutLabel} />
        </MenuItem>
      </Menu>
    </>
  )
}
