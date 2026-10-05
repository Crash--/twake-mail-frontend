import { ClockOutline, Icon } from '@linagora/twake-icons'
import type { ReactElement } from 'react'
import { Link, useMatch } from 'react-router'

import { NavTreeItem } from '@/ds/NavTreeItem/NavTreeItem'
import { useI18n } from '@common/i18n/useI18n'

/** Path of the emails needing an action, a virtual folder */
export const ACTION_REQUIRED_PATH = '/action-required'

export interface ActionRequiredTreeItemProps {
  /** Position among the top level folders, as `aria-posinset` */
  position: number
  siblingCount: number
}

/**
 * The emails needing an action, after Starred, as tmail-flutter's "Action
 * required" virtual folder (offered when the server has the AI capability
 * and the label categorisation is on). It shows no counter, as in
 * tmail-flutter.
 */
export function ActionRequiredTreeItem({
  position,
  siblingCount
}: ActionRequiredTreeItemProps): ReactElement {
  const { t } = useI18n()
  const isSelected = useMatch(`${ACTION_REQUIRED_PATH}/*`) !== null

  return (
    <NavTreeItem
      level={1}
      icon={<Icon icon={ClockOutline} />}
      label={t('mailbox.actionRequired')}
      linkComponent={Link}
      to={ACTION_REQUIRED_PATH}
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
        'data-mailbox-role': 'needs-action'
      }}
    />
  )
}
