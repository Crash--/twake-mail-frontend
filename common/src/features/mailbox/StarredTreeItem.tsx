import { Star } from '@linagora/twake-icons'
import { NavIcon, NavItem, NavLink, NavText } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { Link, useMatch } from 'react-router'

import { IconSlot } from '@/ds/IconSlot/IconSlot'
import { useI18n } from '@common/i18n/useI18n'

/** Path of the starred emails, a virtual folder */
export const STARRED_PATH = '/starred'

export interface StarredTreeItemProps {
  /** Position among the top level folders, as `aria-posinset` */
  position: number
  siblingCount: number
  hasToggleSlot: boolean
}

/**
 * The starred emails, after the Inbox, as tmail-flutter's "Starred"
 * virtual folder: every email with the `$flagged` keyword.
 */
export function StarredTreeItem({
  position,
  siblingCount,
  hasToggleSlot
}: StarredTreeItemProps): ReactElement {
  const { t } = useI18n()
  const isSelected = useMatch(`${STARRED_PATH}/*`) !== null

  return (
    <NavItem
      role="treeitem"
      aria-level={1}
      aria-posinset={position}
      aria-setsize={siblingCount}
      aria-selected={isSelected}
      aria-current={isSelected ? 'page' : undefined}
      data-testid="mailbox-item"
      data-mailbox-role="favorite"
    >
      {hasToggleSlot ? <IconSlot /> : null}
      <NavLink
        component={Link}
        to={STARRED_PATH}
        selected={isSelected}
        className={hasToggleSlot ? 'u-ml-0 u-ov-hidden' : 'u-ov-hidden'}
      >
        <NavIcon icon={Star} />
        <NavText
          className="u-flex-auto u-ellipsis"
          data-testid="mailbox-item-name"
        >
          {t('mailbox.starred')}
        </NavText>
      </NavLink>
    </NavItem>
  )
}
