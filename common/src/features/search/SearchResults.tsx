import { Icon, Left, Magnifier } from '@linagora/twake-icons'
import {
  Box,
  Empty,
  IconButton,
  ListSkeleton,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactElement
} from 'react'
import { useLocation, useMatch, useNavigate } from 'react-router'

import { useThreadPreference } from '@common/features/settings/threadPreference'
import { EmailList } from '@common/features/thread/EmailList'
import { useI18n } from '@common/i18n/useI18n'

import { SearchFiltersBar } from './SearchFiltersBar'
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
 * back to the mailboxes.
 */
export function SearchResults({ filter }: SearchResultsProps): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const context = useSearchContext()
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

  const handleBack = (): void => {
    void navigate('/')
  }

  const backLabel = t('search.backToMailbox')
  const empty = useMemo(
    () => (
      <Empty
        icon={Magnifier}
        title={t('search.empty')}
        data-testid="empty-search-view"
      />
    ),
    [t]
  )
  // In the list toolbar, in place of the filter of a folder
  const filters = useMemo(
    () => <SearchFiltersBar filter={filter} onChange={handleChange} />,
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
            filters,
            opensAtMatch: true
          },
    [request, emailPath, openEmailId, empty, filters]
  )

  return (
    <Box className="u-flex u-flex-column u-h-100" data-testid="search-results">
      <Box className="u-flex u-flex-items-center u-ph-half u-pt-half">
        <Tooltip title={backLabel}>
          <IconButton
            aria-label={backLabel}
            onClick={handleBack}
            data-testid="search-results-back-button"
          >
            <Icon icon={Left} />
          </IconButton>
        </Tooltip>
        <Typography
          ref={headingRef}
          variant="h4"
          component="h1"
          tabIndex={-1}
          className="u-ml-half"
          data-testid="search-results-title"
        >
          {t('search.results')}
        </Typography>
      </Box>
      {search === null ? (
        <ListSkeleton count={8} hasSecondary />
      ) : (
        <EmailList search={search} />
      )}
    </Box>
  )
}
