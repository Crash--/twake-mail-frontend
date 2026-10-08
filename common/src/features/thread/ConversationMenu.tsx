import { Icon, type IconProps } from '@linagora/twake-icons'
import { ListItemIcon, ListItemText, Menu, MenuItem } from '@linagora/twake-mui'
import { useId, useState, type ReactElement } from 'react'

import { MoreVerticalIcon } from '@/ds/ListIcons/ListIcons'
import { IconAction } from '@/ds/IconAction/IconAction'
import { useI18n } from '@common/i18n/useI18n'

export interface ConversationMenuItem {
  id: string
  label: string
  icon: IconProps['icon']
  onSelect: () => void
  'data-testid': string
}

export interface ConversationMenuProps {
  items: readonly ConversationMenuItem[]
}

/**
 * The "More" menu of the toolbar of a conversation: the actions that apply
 * to every one of its messages (read, star, archive, trash, spam)
 */
export function ConversationMenu({
  items
}: ConversationMenuProps): ReactElement {
  const { t } = useI18n()
  const menuId = useId()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const label = t('emailActions.menu.more')
  const close = (): void => {
    setAnchor(null)
  }
  return (
    <>
      <IconAction
        label={label}
        icon={MoreVerticalIcon}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={event => {
          setAnchor(event.currentTarget)
        }}
        data-testid="conversation-more-button"
      />
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={anchor !== null}
        onClose={close}
        data-testid="conversation-menu"
      >
        {items.map(item => (
          <MenuItem
            key={item.id}
            onClick={() => {
              close()
              item.onSelect()
            }}
            data-testid={item['data-testid']}
          >
            <ListItemIcon>
              <Icon icon={item.icon} />
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
