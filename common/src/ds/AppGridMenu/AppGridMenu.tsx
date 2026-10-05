// Upstream to twake-ui: yes. Every Twake app needs the app switcher of the
// Twake Workplace bar; twake-mui has no app grid. Upstream it would show the
// icons in a grid rather than a list.
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

export interface AppGridEntry {
  name: string
  /** Opened in a new tab */
  link: string
  /** URL of the icon, decorative: the name is the accessible name */
  icon: string
}

export interface AppGridMenuTestIds {
  button?: string
  menu?: string
  item?: string
}

export interface AppGridMenuProps {
  apps: readonly AppGridEntry[]
  /** Name and tooltip of the toggle button, e.g. "Go to applications" */
  label: string
  testIds?: AppGridMenuTestIds
}

/**
 * An icon button opening a menu of links to other applications, each in a
 * new tab. Renders nothing without applications.
 */
export function AppGridMenu({
  apps,
  label,
  testIds = {}
}: AppGridMenuProps): ReactElement | null {
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
      <Tooltip title={label}>
        <IconButton
          size="small"
          aria-label={label}
          aria-controls={anchor ? menuId : undefined}
          aria-haspopup="true"
          aria-expanded={anchor ? 'true' : undefined}
          onClick={handleOpen}
          data-testid={testIds.button}
        >
          <Icon icon={Apps} />
        </IconButton>
      </Tooltip>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={anchor !== null}
        onClose={handleClose}
        data-testid={testIds.menu}
      >
        {apps.map(app => (
          <MenuItem
            key={app.name}
            component="a"
            href={app.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClose}
            data-testid={testIds.item}
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
