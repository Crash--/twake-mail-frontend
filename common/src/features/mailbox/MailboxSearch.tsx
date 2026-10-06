import { Cross, Eye, Icon } from '@linagora/twake-icons'
import {
  Box,
  Button,
  IconButton,
  SearchBar,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement
} from 'react'
import { Link, useNavigate } from 'react-router'

import { NavTree } from '@/ds/NavTree/NavTree'
import type { FolderMenuAnchor } from '@common/features/mailboxActions/FolderActionsMenu'
import { settingsSectionPath } from '@common/features/settings/sections'
import { useI18n } from '@common/i18n/useI18n'

import { MailboxTreeItem } from './MailboxTreeItem'
import type { MailboxSummary } from './queries'
import { searchMailboxes } from './searchMailboxes'
import { useMailboxes } from './useMailboxes'
import { useMailboxName } from './useMailboxName'

export interface MailboxSearchProps {
  /** Id of the panel, for the `aria-controls` of the magnifier */
  id: string
  selectedId: string | null
  /** Escape; the caller gives the focus back to the magnifier */
  onClose: () => void
  onOpenMenu: (mailbox: MailboxSummary, anchor: FolderMenuAnchor) => void
}

/**
 * The search of folders of the sidebar, as tmail-flutter: a field and the
 * folders whose name matches, hidden ones included, with their path (the
 * address of a team mailbox), each with the menu of the folder, where a
 * hidden folder is shown again. It takes the place of the trees while it is
 * open. The focus starts in the field; Escape closes it from anywhere in the
 * panel, Enter opens the first folder found, ArrowDown goes down to the
 * results and the count of folders found is announced.
 */
export function MailboxSearch({
  id,
  selectedId,
  onClose,
  onOpenMenu
}: MailboxSearchProps): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const getName = useMailboxName()
  const { data: mailboxes } = useMailboxes()
  const statusId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')

  const results = useMemo(
    () => searchMailboxes(mailboxes ?? [], query, getName),
    [mailboxes, query, getName]
  )
  const isSearching = query.trim() !== ''
  const label = t('folders.search.label')
  const clearLabel = t('search.clear')

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Escape closes the search from the field and from the results, and only
  // that: in the drawer it must not close the drawer as well
  useEffect(() => {
    const panel = panelRef.current
    if (panel === null) return undefined
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    panel.addEventListener('keydown', handleKeyDown)
    return () => {
      panel.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setQuery(event.target.value)
  }
  const handleClear = (): void => {
    setQuery('')
    inputRef.current?.focus()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      const first = panelRef.current?.querySelector<HTMLElement>(
        '[data-testid="mailbox-search-results"] [role="treeitem"]'
      )
      if (first) {
        event.preventDefault()
        first.focus()
      }
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const first = results[0]
      if (first) {
        void navigate(`/mailbox/${encodeURIComponent(first.row.mailbox.id)}`)
      }
    }
  }

  const countText = isSearching
    ? results.length === 0
      ? t('folders.search.empty')
      : t('folders.search.results', { smart_count: results.length })
    : ''

  return (
    <Box
      ref={panelRef}
      id={id}
      role="search"
      aria-label={label}
      className="u-mh-1"
      data-testid="mailbox-search"
    >
      <SearchBar
        size="small"
        elevation={0}
        className="u-w-100"
        placeholder={label}
        value={query}
        disabledClear
        onChange={handleChange}
        componentsProps={{
          inputBase: {
            inputRef,
            onKeyDown: handleKeyDown,
            endAdornment:
              query === '' ? null : (
                <Tooltip title={clearLabel}>
                  <IconButton
                    size="small"
                    aria-label={clearLabel}
                    onClick={handleClear}
                    data-testid="mailbox-search-clear-button"
                  >
                    <Icon icon={Cross} />
                  </IconButton>
                </Tooltip>
              ),
            inputProps: {
              'aria-label': label,
              'aria-describedby': statusId,
              autoComplete: 'off',
              enterKeyHint: 'search',
              'data-testid': 'mailbox-search-input'
            }
          }
        }}
      />
      <Typography
        id={statusId}
        role="status"
        component="div"
        variant="body2"
        className={
          results.length === 0 && isSearching ? 'u-p-1' : 'u-visuallyhidden'
        }
        data-testid="mailbox-search-status"
      >
        {countText}
      </Typography>
      {results.length > 0 ? (
        <NavTree
          role="tree"
          aria-labelledby={statusId}
          data-testid="mailbox-search-results"
        >
          {results.map(({ row, path }) => (
            <MailboxTreeItem
              key={row.mailbox.id}
              row={row}
              secondary={path}
              isSelected={row.mailbox.id === selectedId}
              onToggle={noToggle}
              onOpenMenu={onOpenMenu}
            />
          ))}
        </NavTree>
      ) : null}
      <Button
        component={Link}
        to={settingsSectionPath('folder-visibility')}
        variant="text"
        size="small"
        color="inherit"
        startIcon={<Icon icon={Eye} />}
        data-testid="mailbox-search-visibility-link"
      >
        {t('settings.sections.folderVisibility.title')}
      </Button>
    </Box>
  )
}

function noToggle(): void {
  // Results are flat: no row has an expand arrow
}
