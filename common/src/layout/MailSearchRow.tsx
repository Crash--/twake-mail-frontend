import { useRef, type ReactElement } from 'react'

import { SearchRow } from '@/ds/SearchRow/SearchRow'
import { useShortcuts } from '@common/features/shortcuts/ShortcutsProvider'

import { MailSearchBar } from './MailSearchBar'
import { SettingsButton } from './SettingsButton'

/**
 * The top of the page on desktops: the search, and the settings at the far
 * end of the row. Below the desktop size the search is in the top bar and
 * the settings in the account menu, or behind a gear under the platform bar.
 * The `/` shortcut focuses the search.
 */
export function MailSearchRow(): ReactElement {
  const searchRef = useRef<HTMLDivElement>(null)
  useShortcuts({
    '/': () => searchRef.current?.querySelector('input')?.focus()
  })

  return (
    <SearchRow
      search={<MailSearchBar />}
      searchRef={searchRef}
      actions={<SettingsButton />}
      data-testid="search-row"
    />
  )
}
