import { Box, Typography } from '@linagora/twake-mui'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactElement
} from 'react'
import { useLocation, useMatch, useNavigate } from 'react-router'

import { EmptyListView } from '@/ds/EmptyListView/EmptyListView'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useThreadPreference } from '@common/features/settings/threadPreference'
import { EmailList } from '@common/features/thread/EmailList'
import { EmailListSkeleton } from '@common/features/thread/EmailListSkeleton'
import { useI18n } from '@common/i18n/useI18n'

import { SearchFiltersRow } from './SearchFiltersRow'
import { SearchSortButton } from './SearchSortButton'
import {
  searchPath,
  toSearchParams,
  toSearchRequest,
  type SearchFilter
} from './searchFilter'
import { useSearchContext } from './useSearchContext'

export interface SearchResultsProps {
  filter: SearchFilter
}

function hasFocusTarget(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'focusEmailId' in state
}

/**
 * The results of a search (`/search?…`): a heading, the filters, and the
 * emails found, the matches highlighted. Each result opens at
 * `/search/email/:emailId?…`, which keeps the search; the back button goes
 * back to the mailboxes. On a desktop the layout shows the filters above
 * the card of the list (`SearchFiltersHeader`), as tmail-flutter.
 */
export function SearchResults({ filter }: SearchResultsProps): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const context = useSearchContext()
  const screenSize = useScreenSize()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const params = toSearchParams(filter).toString()
  const openEmailId = useMatch('/search/email/:emailId')?.params.emailId ?? null
  // One result per conversation when conversations are on, as tmail-flutter
  const { isEnabled: collapseThreads } = useThreadPreference()
  const request = useMemo(
    () =>
      context === null
        ? null
        : { ...toSearchRequest(filter, context), collapseThreads },
    // The params say all the filter does
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context, params, collapseThreads]
  )
  const emailPath = useCallback(
    (emailId: string): string =>
      `/search/email/${encodeURIComponent(emailId)}?${params}`,
    [params]
  )
  const shouldFocusHeading = !hasFocusTarget(location.state)

  // A new screen: the focus goes to its heading, unless coming back from a
  // result, whose row takes it
  useEffect(() => {
    if (shouldFocusHeading) headingRef.current?.focus()
    // Once, when the results open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = useCallback(
    (changed: SearchFilter): void => {
      void navigate(searchPath(changed), { replace: true })
    },
    [navigate]
  )

  const empty = useMemo(
    () => (
      <EmptyListView
        title={t('search.empty')}
        data-testid="empty-search-view"
      />
    ),
    [t]
  )
  const toolbarEnd = useMemo(
    () => <SearchSortButton filter={filter} onChange={handleChange} />,
    [filter, handleChange]
  )
  const search = useMemo(
    () =>
      request === null
        ? null
        : {
            request,
            emailPath,
            openEmailId,
            empty,
            toolbarEnd,
            opensAtMatch: true
          },
    [request, emailPath, openEmailId, empty, toolbarEnd]
  )

  return (
    <Box className="u-flex u-flex-column u-h-100" data-testid="search-results">
      {/* The title is for the screen readers and the page title: the
          design shows the filters right under the search */}
      <Typography
        ref={headingRef}
        variant="h1"
        tabIndex={-1}
        className="u-visuallyhidden"
        data-testid="search-results-title"
      >
        {t('search.results')}
      </Typography>
      {/* On a desktop the layout shows them above the card, as tmail-flutter */}
      {screenSize === 'desktop' ? null : (
        <Box className="u-ph-half u-pt-half">
          <SearchFiltersRow filter={filter} />
        </Box>
      )}
      {search === null ? (
        <EmailListSkeleton
          isCompact={screenSize !== 'desktop'}
          className="u-flex-auto"
        />
      ) : (
        <EmailList search={search} />
      )}
    </Box>
  )
}
