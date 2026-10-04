import { Filter, Icon } from '@linagora/twake-icons'
import { IconButton, Tooltip } from '@linagora/twake-mui'
import { useMemo, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router'

import {
  SearchCombobox,
  type SearchComboboxGroup,
  type SearchComboboxOption
} from '@/ds/SearchCombobox/SearchCombobox'
import { formatAddressNames } from '@common/features/email/addresses'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { AdvancedSearchDialog } from './AdvancedSearchDialog'
import { HighlightedText } from './HighlightedText'
import { QuickSearchFilters } from './QuickSearchFilters'
import {
  EMPTY_SEARCH_FILTER,
  searchPath,
  toSearchParams,
  withTypedText,
  type SearchFilter
} from './searchFilter'
import { addRecentSearch, storeSortOrder } from './searchStorage'
import { useSearchContext } from './useSearchContext'
import { useSearchSuggestions } from './useSearchSuggestions'

/** Recent searches suggested under a non-empty field */
const RECENT_WITH_TEXT = 3

const SHOW_ALL = 'show-all'
const RECENT_PREFIX = 'recent:'
const CONTACT_PREFIX = 'contact:'
const EMAIL_PREFIX = 'email:'

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
  const navigate = useNavigate()
  const { accountId, session } = useJmapSession()
  const context = useSearchContext()
  const [draft, setDraft] = useState(initialFilter)
  const [isOpen, setIsOpen] = useState(false)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const suggestions = useSearchSuggestions(draft.text, draft, context, isOpen)
  const hasText = draft.text.trim() !== ''

  const runSearch = (filter: SearchFilter): void => {
    addRecentSearch(accountId, filter.text)
    setIsAdvancedOpen(false)
    void navigate(searchPath(filter))
  }

  const handleSubmit = (): void => {
    runSearch(withTypedText(draft, draft.text))
  }

  const handleChange = (text: string): void => {
    setDraft(current => ({ ...current, text }))
  }

  const groups = useMemo((): SearchComboboxGroup[] => {
    const showAll: SearchComboboxOption[] = hasText
      ? [
          {
            id: SHOW_ALL,
            label: t('search.searchFor', { text: draft.text.trim() }),
            'data-testid': 'search-suggestion-show-all'
          }
        ]
      : []
    const recent = hasText
      ? suggestions.recent.slice(0, RECENT_WITH_TEXT)
      : suggestions.recent
    return [
      { id: 'show-all', label: null, options: showAll },
      {
        id: 'recent',
        label: t('search.recent'),
        options: recent.map(text => ({
          id: `${RECENT_PREFIX}${text}`,
          label: text,
          'data-testid': 'search-suggestion-recent'
        }))
      },
      {
        id: 'contacts',
        label: t('search.contacts'),
        options: suggestions.contacts.map(contact => {
          const name = `${contact.firstname} ${contact.surname}`.trim()
          return {
            id: `${CONTACT_PREFIX}${contact.emailAddress}`,
            label: name === '' ? contact.emailAddress : name,
            secondary: name === '' ? undefined : contact.emailAddress,
            'data-testid': 'search-suggestion-contact'
          }
        })
      },
      {
        id: 'emails',
        label: t('search.emails'),
        options: suggestions.emails.map(({ email, snippet }) => ({
          id: `${EMAIL_PREFIX}${email.id}`,
          label: (
            <HighlightedText
              text={email.subject ?? ''}
              snippet={snippet?.subject ?? null}
            />
          ),
          secondary: (
            <>
              {`${formatAddressNames(email.from)} – `}
              <HighlightedText
                text={email.preview}
                snippet={snippet?.preview ?? null}
              />
            </>
          ),
          'data-testid': 'search-suggestion-item'
        }))
      }
    ]
  }, [t, hasText, draft.text, suggestions])

  const handleSelect = (option: SearchComboboxOption): void => {
    if (option.id === SHOW_ALL) {
      handleSubmit()
    } else if (option.id.startsWith(RECENT_PREFIX)) {
      runSearch(withTypedText(draft, option.id.slice(RECENT_PREFIX.length)))
    } else if (option.id.startsWith(CONTACT_PREFIX)) {
      // As tmail-flutter: the emails of that contact, nothing else
      runSearch({
        ...EMPTY_SEARCH_FILTER,
        sort: draft.sort,
        from: [option.id.slice(CONTACT_PREFIX.length)]
      })
    } else if (option.id.startsWith(EMAIL_PREFIX)) {
      const filter = withTypedText(draft, draft.text)
      addRecentSearch(accountId, filter.text)
      const emailId = encodeURIComponent(option.id.slice(EMAIL_PREFIX.length))
      void navigate(
        `/search/email/${emailId}?${toSearchParams(filter).toString()}`
      )
    }
  }

  const count = groups.reduce((sum, group) => sum + group.options.length, 0)
  const advancedLabel = t('search.advanced')

  return (
    <>
      <SearchCombobox
        className="u-w-100 u-maw-7"
        value={draft.text}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onSelect={handleSelect}
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
        status={
          suggestions.isLoading
            ? t('search.loading')
            : t('search.suggestionCount', { smart_count: count })
        }
        endActions={
          <Tooltip title={advancedLabel}>
            <IconButton
              size="small"
              aria-label={advancedLabel}
              aria-haspopup="dialog"
              onClick={() => {
                setIsAdvancedOpen(true)
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
      {isAdvancedOpen ? (
        <AdvancedSearchDialog
          filter={withTypedText(draft, draft.text)}
          onClose={() => {
            setIsAdvancedOpen(false)
          }}
          onSubmit={filter => {
            storeSortOrder(filter.sort)
            runSearch(filter)
          }}
        />
      ) : null}
    </>
  )
}
