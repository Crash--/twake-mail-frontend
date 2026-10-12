import { Icon } from '@linagora/twake-icons'
import { getInitials } from '@linagora/twake-mui'
import { useMemo, useRef, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router'

import {
  SearchCombobox,
  type SearchComboboxActions,
  type SearchComboboxGroup,
  type SearchComboboxOption
} from '@/ds/SearchCombobox/SearchCombobox'
import {
  Attachment,
  ClockOutline,
  FilterAdvanced,
  Star,
  StarOutline
} from '@/ds/FlutterIcons/FlutterIcons'
import { GradientAvatar } from '@/ds/GradientAvatar/GradientAvatar'
import { SearchBarAction } from '@/ds/SearchBarAction/SearchBarAction'
import { TMAIL } from '@/ds/TmailColors/tmailColors'
import { prepareViewTransition } from '@/ds/ViewTransition/viewTransition'
import { formatAddressNames } from '@common/features/email/addresses'
import { FLAGGED } from '@common/features/email/keywords'
import { formatListDate } from '@common/features/thread/formatListDate'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { AdvancedSearchDialog } from './AdvancedSearchDialog'
import { HighlightedText } from './HighlightedText'
import { QuickSearchFilters } from './QuickSearchFilters'
import {
  EMPTY_SEARCH_FILTER,
  isEmptySearch,
  searchPath,
  toSearchParams,
  usesAdvancedFields,
  withTypedText,
  type SearchFilter
} from './searchFilter'
import { addRecentSearch, storeSortOrder } from './searchStorage'
import { useSearchContext } from './useSearchContext'
import { useSearchSuggestions } from './useSearchSuggestions'

/** The stars of tmail-flutter (`ic_star.svg`, `ic_unstar.svg`) */
const STARRED_COLOR = '#FFCC00'
const UNSTARRED_COLOR = TMAIL.greyStar

/** Recent searches suggested under a non-empty field */
const RECENT_WITH_TEXT = 3

const SHOW_ALL = 'show-all'
const RECENT_PREFIX = 'recent:'
const CONTACT_PREFIX = 'contact:'
const EMAIL_PREFIX = 'email:'

export interface SearchFieldProps {
  /** The search of the results on screen, an empty one elsewhere */
  initialFilter: SearchFilter
  /**
   * `compact`: the smaller field of tmail-flutter's phones and tablets;
   * `bare`: the white field of the bar of their search view
   */
  size?: 'large' | 'compact' | 'bare'
}

/**
 * The search field of the top bar. While typing, it suggests a search for
 * the text, recent searches, contacts and the first matching emails, under
 * quick filters; Enter or "Showing results for" shows every result
 * (`/search?…`), an email suggestion opens that email among them. The
 * advanced search edits the same search.
 */
export function SearchField({
  initialFilter,
  size = 'large'
}: SearchFieldProps): ReactElement {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const { accountId, session } = useJmapSession()
  const context = useSearchContext()
  const [draft, setDraft] = useState(initialFilter)
  const [isOpen, setIsOpen] = useState(false)
  // The form opens over the field: `anchor` is that field
  const [advanced, setAdvanced] = useState<{
    anchor: HTMLElement | null
  } | null>(null)
  const combobox = useRef<SearchComboboxActions>(null)
  const suggestions = useSearchSuggestions(draft.text, draft, context, isOpen)
  const hasText = draft.text.trim() !== ''
  // Filters picked under an empty field: an option runs them, as "Search
  // for …" does for a text (Enter alone is no help to a mouse or a finger)
  const hasFiltersOnly = !hasText && !isEmptySearch(draft)

  const runSearch = (filter: SearchFilter): void => {
    addRecentSearch(accountId, filter.text)
    setAdvanced(null)
    void navigate(searchPath(filter))
  }

  const handleSubmit = (): void => {
    runSearch(withTypedText(draft, draft.text))
  }

  const handleChange = (text: string): void => {
    setDraft(current => ({ ...current, text }))
  }

  const groups = useMemo((): SearchComboboxGroup[] => {
    const showAll: SearchComboboxOption[] =
      hasText || hasFiltersOnly
        ? [
            // As tmail-flutter: "Showing results for: "text""
            hasText
              ? {
                  id: SHOW_ALL,
                  hint: t('search.showingResultsFor'),
                  label: `"${draft.text.trim()}"`,
                  'data-testid': 'search-suggestion-show-all'
                }
              : {
                  id: SHOW_ALL,
                  label: t('search.searchWithFilters'),
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
        options: recent.map(({ text, at }) => ({
          id: `${RECENT_PREFIX}${text}`,
          label: text,
          icon: <Icon icon={ClockOutline} className="u-flex-shrink-0" />,
          end:
            at === null
              ? undefined
              : formatListDate(new Date(at).toISOString(), lang),
          'data-testid': 'search-suggestion-recent'
        }))
      },
      {
        id: 'contacts',
        label: t('search.contacts'),
        isLabelHidden: true,
        options: suggestions.contacts.map(contact => {
          const name = `${contact.firstname} ${contact.surname}`.trim()
          return {
            id: `${CONTACT_PREFIX}${contact.emailAddress}`,
            label: name === '' ? contact.emailAddress : name,
            secondary: name === '' ? undefined : contact.emailAddress,
            // As tmail-flutter: a light grey disc, black initials
            icon: (
              <GradientAvatar
                text={getInitials(name, contact.emailAddress)}
                colorKey={contact.emailAddress}
                size={40}
                fontSize={16}
                look="plain"
              />
            ),
            'data-testid': 'search-suggestion-contact'
          }
        })
      },
      {
        id: 'emails',
        label: t('search.emails'),
        isLabelHidden: true,
        options: suggestions.emails.map(({ email, snippet }) => ({
          id: `${EMAIL_PREFIX}${email.id}`,
          // As tmail-flutter: the star, the sender then the subject, the
          // attachment and the date, and the preview under them
          icon: (
            <Icon
              icon={email.keywords[FLAGGED] === true ? Star : StarOutline}
              size={18}
              color={
                email.keywords[FLAGGED] === true
                  ? STARRED_COLOR
                  : UNSTARRED_COLOR
              }
              className="u-flex-shrink-0"
            />
          ),
          label: formatAddressNames(email.from),
          isStrong: true,
          detail: (
            <HighlightedText
              text={email.subject ?? ''}
              snippet={snippet?.subject ?? null}
            />
          ),
          end: (
            <>
              {email.hasAttachment ? (
                <Icon icon={Attachment} size={14} color={UNSTARRED_COLOR} />
              ) : null}
              {formatListDate(email.receivedAt, lang)}
            </>
          ),
          secondary: (
            <HighlightedText
              text={email.preview}
              snippet={snippet?.preview ?? null}
            />
          ),
          'data-testid': 'search-suggestion-item'
        }))
      }
    ]
  }, [t, lang, hasText, hasFiltersOnly, draft.text, suggestions])

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
        `/search/email/${emailId}?${toSearchParams(filter).toString()}`,
        { viewTransition: prepareViewTransition('forward') }
      )
    }
  }

  const count = groups.reduce((sum, group) => sum + group.options.length, 0)
  const status = ((): string => {
    if (suggestions.isLoading) return t('search.loading')
    // Only the quick filters are shown: say so rather than "0 suggestions"
    if (count === 0 && !hasText) return t('search.quickFiltersOnly')
    return t('search.suggestionCount', { smart_count: count })
  })()

  return (
    <>
      <SearchCombobox
        className="u-w-100"
        size={size}
        actions={combobox}
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
        status={status}
        endActions={
          // As tmail-flutter: hidden while the advanced search is open
          <SearchBarAction
            label={t('search.advanced')}
            icon={FilterAdvanced}
            isActive={usesAdvancedFields(initialFilter)}
            isHidden={advanced !== null}
            aria-haspopup="dialog"
            onClick={() => {
              setAdvanced({ anchor: combobox.current?.getField() ?? null })
            }}
            data-testid="advanced-search-button"
          />
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
            runSearch(filter)
          }}
        />
      ) : null}
    </>
  )
}
