import { Apps, Icon } from '@linagora/twake-icons'
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip
} from '@linagora/twake-mui'
import { useId, useState, type MouseEvent, type ReactElement } from 'react'

import type { AppListEntry } from '@common/config/config'
import { useI18n } from '@common/i18n/useI18n'

export interface AppGridMenuProps {
  apps: readonly AppListEntry[]
}

/**
 * Links to the other Twake applications, listed by `public/appList.js`.
 */
export function AppGridMenu({ apps }: AppGridMenuProps): ReactElement | null {
  const { t } = useI18n()
  const menuId = useId()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  if (apps.length === 0) return null

  const handleOpen = (event: MouseEvent<HTMLElement>): void => {
    setAnchor(event.currentTarget)
  }

  const handleClose = (): void => {
    setAnchor(null)
  }

  return (
    <>
      <Tooltip title={t('topbar.apps')}>
        <IconButton
          aria-label={t('topbar.apps')}
          aria-controls={anchor ? menuId : undefined}
          aria-haspopup="true"
          aria-expanded={anchor ? 'true' : undefined}
          onClick={handleOpen}
          data-testid="app-grid-toggle-button"
        >
          <Icon icon={Apps} />
        </IconButton>
      </Tooltip>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={anchor !== null}
        onClose={handleClose}
        data-testid="app-grid-list"
      >
        {apps.map(app => (
          <MenuItem
            key={app.name}
            component="a"
            href={app.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClose}
            data-testid="app-grid-item"
            data-app-name={app.name}
          >
            <ListItemIcon>
              <img src={app.icon} alt="" width={24} height={24} />
            </ListItemIcon>
            <ListItemText primary={app.name} />
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
