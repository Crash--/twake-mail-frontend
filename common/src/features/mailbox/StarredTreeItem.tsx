import { Icon, StarOutline } from '@linagora/twake-icons'
import type { ReactElement } from 'react'
import { Link, useMatch } from 'react-router'

import { NavTreeItem } from '@/ds/NavTreeItem/NavTreeItem'
import { useI18n } from '@common/i18n/useI18n'

/** Path of the starred emails, a virtual folder */
export const STARRED_PATH = '/starred'

export interface StarredTreeItemProps {
  /** Position among the top level folders, as `aria-posinset` */
  position: number
  siblingCount: number
}

/**
 * The starred emails, after the Inbox, as tmail-flutter's "Starred"
 * virtual folder: every email with the `$flagged` keyword.
 */
export function StarredTreeItem({
  position,
  siblingCount
}: StarredTreeItemProps): ReactElement {
  const { t } = useI18n()
  const isSelected = useMatch(`${STARRED_PATH}/*`) !== null

  return (
    <NavTreeItem
      level={1}
      icon={<Icon icon={StarOutline} />}
      label={t('mailbox.starred')}
      linkComponent={Link}
      to={STARRED_PATH}
      isSelected={isSelected}
      nameTestId="mailbox-item-name"
      data-testid="mailbox-item"
      itemProps={{
        role: 'treeitem',
        'aria-level': 1,
        'aria-posinset': position,
        'aria-setsize': siblingCount,
        'aria-selected': isSelected,
        'aria-current': isSelected ? 'page' : undefined,
        'data-mailbox-role': 'favorite'
      }}
    />
  )
}
