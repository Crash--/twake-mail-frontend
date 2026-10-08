import {
  Attachment,
  ClockOutline,
  Icon,
  Email,
  Star
} from '@linagora/twake-icons'
import { Avatar, getInitials } from '@linagora/twake-mui'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'

import type {
  SearchComboboxGroup,
  SearchComboboxOption
} from '@/ds/SearchCombobox/SearchCombobox'
import { prepareViewTransition } from '@/ds/ViewTransition/viewTransition'
import { formatAddressNames } from '@common/features/email/addresses'
import { FLAGGED } from '@common/features/email/keywords'
import { formatListDate } from '@common/features/thread/formatListDate'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { HighlightedText } from './HighlightedText'
import {
  EMPTY_SEARCH_FILTER,
  isEmptySearch,
  searchPath,
  toSearchParams,
  withTypedText,
  type SearchFilter
} from './searchFilter'
import { addRecentSearch } from './searchStorage'
import { useSearchContext } from './useSearchContext'
import { useSearchSuggestions } from './useSearchSuggestions'

/** Recent searches suggested under a non-empty field */
const RECENT_WITH_TEXT = 3

const SHOW_ALL = 'show-all'
const RECENT_PREFIX = 'recent:'
const CONTACT_PREFIX = 'contact:'
const EMAIL_PREFIX = 'email:'

export interface SearchOptions {
  groups: SearchComboboxGroup[]
  /** The number of options, or that they are loading, to announce */
  status: string
  /** An option of `groups` chosen */
  select: (option: SearchComboboxOption) => void
  /** Every result of the search being typed (`/search?…`) */
  submit: () => void
  /** Remembers the text of a search and shows every result */
  run: (filter: SearchFilter) => void
}

/**
 * What a search field offers while the user types, from `draft`: a search
 * for the text, recent searches, contacts and the first matching emails.
 * Choosing an option runs its search, or opens the email among the results.
 * Nothing is fetched while `isOpen` is false.
 */
export function useSearchOptions(
  draft: SearchFilter,
  isOpen: boolean
): SearchOptions {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const { accountId } = useJmapSession()
  const context = useSearchContext()
  const suggestions = useSearchSuggestions(draft.text, draft, context, isOpen)
  const hasText = draft.text.trim() !== ''
  // Filters picked under an empty field: an option runs them, as "Search
  // for …" does for a text (Enter alone is no help to a mouse or a finger)
  const hasFiltersOnly = !hasText && !isEmptySearch(draft)

  const run = (filter: SearchFilter): void => {
    addRecentSearch(accountId, filter.text)
    void navigate(searchPath(filter))
  }

  const submit = (): void => {
    run(withTypedText(draft, draft.text))
  }

  const groups = useMemo((): SearchComboboxGroup[] => {
    const showAll: SearchComboboxOption[] =
      hasText || hasFiltersOnly
        ? [
            {
              id: SHOW_ALL,
              label: hasText
                ? t('search.searchFor', { text: draft.text.trim() })
                : t('search.searchWithFilters'),
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
            icon: (
              <Avatar component="span" size={40} className="u-flex-shrink-0">
                {getInitials(name, contact.emailAddress)}
              </Avatar>
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
          icon: (
            <Icon
              icon={email.keywords[FLAGGED] === true ? Star : Email}
              className="u-flex-shrink-0"
            />
          ),
          end: (
            <>
              {formatListDate(email.receivedAt, lang)}
              {email.hasAttachment ? <Icon icon={Attachment} /> : null}
            </>
          ),
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
  }, [t, lang, hasText, hasFiltersOnly, draft.text, suggestions])

  const select = (option: SearchComboboxOption): void => {
    if (option.id === SHOW_ALL) {
      submit()
    } else if (option.id.startsWith(RECENT_PREFIX)) {
      run(withTypedText(draft, option.id.slice(RECENT_PREFIX.length)))
    } else if (option.id.startsWith(CONTACT_PREFIX)) {
      // As tmail-flutter: the emails of that contact, nothing else
      run({
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

  return { groups, status, select, submit, run }
}
