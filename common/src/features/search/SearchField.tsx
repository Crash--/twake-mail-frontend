import { Filter, Icon } from '@linagora/twake-icons'
import { IconButton, Tooltip } from '@linagora/twake-mui'
import { useRef, useState, type ReactElement } from 'react'

import {
  SearchCombobox,
  type SearchComboboxActions
} from '@/ds/SearchCombobox/SearchCombobox'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { AdvancedSearchDialog } from './AdvancedSearchDialog'
import { QuickSearchFilters } from './QuickSearchFilters'
import { withTypedText, type SearchFilter } from './searchFilter'
import { storeSortOrder } from './searchStorage'
import { useSearchOptions } from './useSearchOptions'

export interface SearchFieldProps {
  /** The search of the results on screen, an empty one elsewhere */
  initialFilter: SearchFilter
}

/**
 * The search field of the top bar. While typing, it suggests a search for
 * the text, recent searches, contacts and the first matching emails, under
 * quick filters; Enter or "Search for" shows every result
 * (`/search?…`), an email suggestion opens that email among them. The
 * advanced search edits the same search.
 */
export function SearchField({ initialFilter }: SearchFieldProps): ReactElement {
  const { t } = useI18n()
  const { session } = useJmapSession()
  const [draft, setDraft] = useState(initialFilter)
  const [isOpen, setIsOpen] = useState(false)
  // The form opens over the field: `anchor` is that field
  const [advanced, setAdvanced] = useState<{
    anchor: HTMLElement | null
  } | null>(null)
  const combobox = useRef<SearchComboboxActions>(null)
  const { groups, status, select, submit, run } = useSearchOptions(
    draft,
    isOpen
  )

  const handleChange = (text: string): void => {
    setDraft(current => ({ ...current, text }))
  }

  const advancedLabel = t('search.advanced')

  return (
    <>
      <SearchCombobox
        className="u-w-100"
        actions={combobox}
        value={draft.text}
        onChange={handleChange}
        onSubmit={submit}
        onSelect={select}
        onOpenChange={setIsOpen}
        groups={groups}
        header={
          <QuickSearchFilters
            filter={draft}
            ownAddress={session.username}
            onChange={setDraft}
          />
        }
        label={t('search.placeholder')}
        listLabel={t('search.suggestions')}
        clearLabel={t('search.clear')}
        status={status}
        endActions={
          <Tooltip title={advancedLabel}>
            <IconButton
              size="small"
              aria-label={advancedLabel}
              aria-haspopup="dialog"
              onClick={() => {
                setAdvanced({ anchor: combobox.current?.getField() ?? null })
              }}
              data-testid="advanced-search-button"
            >
              <Icon icon={Filter} />
            </IconButton>
          </Tooltip>
        }
        testIds={{
          input: 'search-input',
          clear: 'search-clear-button',
          listbox: 'search-suggestions'
        }}
        data-testid="search-bar"
      />
      {advanced !== null ? (
        <AdvancedSearchDialog
          filter={withTypedText(draft, draft.text)}
          anchorEl={advanced.anchor}
          onClose={() => {
            setAdvanced(null)
          }}
          onSubmit={filter => {
            storeSortOrder(filter.sort)
            setAdvanced(null)
            run(filter)
          }}
        />
      ) : null}
    </>
  )
}
