import { Filter, Icon } from '@linagora/twake-icons'
import {
  DropdownButton,
  Menu,
  MenuItem,
  ListItemText
} from '@linagora/twake-mui'
import { useId, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router'

import {
  EMPTY_SEARCH_FILTER,
  searchPath,
  type SearchFilter
} from '@common/features/search/searchFilter'
import { useI18n } from '@common/i18n/useI18n'

interface FilterEntry {
  id: 'attachments' | 'unread' | 'starred'
  label:
    | 'search.filters.hasAttachment'
    | 'search.filters.unread'
    | 'search.filters.starred'
  filter: Partial<SearchFilter>
}

const ENTRIES: readonly FilterEntry[] = [
  { id: 'unread', label: 'search.filters.unread', filter: { unread: true } },
  {
    id: 'starred',
    label: 'search.filters.starred',
    filter: { starred: true }
  },
  {
    id: 'attachments',
    label: 'search.filters.hasAttachment',
    filter: { hasAttachment: true }
  }
]

export interface EmailListFilterMenuProps {
  /** The folder the filters look in */
  mailboxId: string
}

/**
 * "Filter" of the list toolbar: unread, starred, with attachment. The
 * folder has no filtered list of its own; each entry shows the matching
 * emails of the folder as a search (`/search?…`), which pages through the
 * server like any other.
 */
export function EmailListFilterMenu({
  mailboxId
}: EmailListFilterMenuProps): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const menuId = useId()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  const handleSelect = (entry: FilterEntry): void => {
    setAnchor(null)
    void navigate(
      searchPath({
        ...EMPTY_SEARCH_FILTER,
        ...entry.filter,
        scope: { kind: 'mailbox', mailboxId }
      })
    )
  }

  return (
    <>
      <DropdownButton
        variant="text"
        color="inherit"
        startIcon={<Icon icon={Filter} />}
        aria-haspopup="menu"
        aria-controls={anchor ? menuId : undefined}
        aria-expanded={anchor ? 'true' : undefined}
        onClick={event => {
          setAnchor(event.currentTarget)
        }}
        data-testid="list-filter-button"
      >
        {t('thread.toolbar.filter')}
      </DropdownButton>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => {
          setAnchor(null)
        }}
        data-testid="list-filter-menu"
      >
        {ENTRIES.map(entry => (
          <MenuItem
            key={entry.id}
            onClick={() => {
              handleSelect(entry)
            }}
            data-testid={`quick-filter-${entry.id}`}
          >
            <ListItemText primary={t(entry.label)} />
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
