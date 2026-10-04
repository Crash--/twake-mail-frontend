import { EmailOpen } from '@linagora/twake-icons'
import { Box, Empty } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { useOutlet } from 'react-router'

import { ListDetailLayout } from '@/ds/ListDetailLayout/ListDetailLayout'
import { SearchResults } from '@common/features/search/SearchResults'
import { useUrlSearchFilter } from '@common/features/search/useUrlSearchFilter'
import { useI18n } from '@common/i18n/useI18n'

/**
 * `/search?…`: the results of the search the URL holds, and a result
 * opened from them (`email/:emailId`), instead of the list or beside it.
 */
export function SearchPage(): ReactElement | null {
  const { t } = useI18n()
  const filter = useUrlSearchFilter()
  const email = useOutlet()

  if (filter === null) return null
  return (
    <Box className="u-flex u-flex-column u-h-100" data-testid="search-page">
      <ListDetailLayout
        list={<SearchResults filter={filter} />}
        detail={email}
        placeholder={
          <Empty
            icon={EmailOpen}
            title={t('email.noneSelected')}
            data-testid="email-view-empty"
          />
        }
      />
    </Box>
  )
}
