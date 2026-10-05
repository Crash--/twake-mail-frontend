import { Icon, Setting } from '@linagora/twake-icons'
import { IconButton, Tooltip } from '@linagora/twake-mui'
import { useRef, type ReactElement } from 'react'
import { useNavigate } from 'react-router'

import { SearchRow } from '@/ds/SearchRow/SearchRow'
import { useShortcuts } from '@common/features/shortcuts/ShortcutsProvider'
import { SETTINGS_PATH } from '@common/features/settings/sections'
import { useI18n } from '@common/i18n/useI18n'

import { MailSearchBar } from './MailSearchBar'

/**
 * The top of the page on desktops: the search, and the settings at the far
 * end of the row. Below the desktop size the search is in the top bar and
 * the settings in the account menu. The `/` shortcut focuses the search.
 */
export function MailSearchRow(): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const searchRef = useRef<HTMLDivElement>(null)
  useShortcuts({
    '/': () => searchRef.current?.querySelector('input')?.focus()
  })
  const label = t('settings.title')

  return (
    <SearchRow
      search={<MailSearchBar />}
      searchRef={searchRef}
      actions={
        <Tooltip title={label}>
          <IconButton
            aria-label={label}
            onClick={() => {
              void navigate(SETTINGS_PATH)
            }}
            data-testid="settings-button"
          >
            <Icon icon={Setting} />
          </IconButton>
        </Tooltip>
      }
      data-testid="search-row"
    />
  )
}
