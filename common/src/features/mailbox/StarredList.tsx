import { Star } from '@linagora/twake-icons'
import { Empty } from '@linagora/twake-mui'
import { useMemo, type ReactElement } from 'react'
import { useMatch } from 'react-router'

import { FLAGGED } from '@common/features/email/keywords'
import {
  EmailList,
  type EmailListSearch
} from '@common/features/thread/EmailList'
import { useI18n } from '@common/i18n/useI18n'

import { STARRED_PATH } from './StarredTreeItem'

/** The path of a starred email, opened beside or instead of the list */
export function starredEmailPath(emailId: string): string {
  return `${STARRED_PATH}/email/${encodeURIComponent(emailId)}`
}

/**
 * The emails with the `$flagged` keyword, from every folder, most recent
 * first: tmail-flutter's "Starred" virtual folder. Push keeps it up to
 * date, as search results.
 */
export function StarredList(): ReactElement {
  const { t } = useI18n()
  const openEmailId =
    useMatch(`${STARRED_PATH}/email/:emailId`)?.params.emailId ?? null
  const title = t('mailbox.starred')
  const search = useMemo(
    (): EmailListSearch => ({
      request: {
        filter: { hasKeyword: FLAGGED },
        sort: [{ property: 'receivedAt', isAscending: false }]
      },
      emailPath: starredEmailPath,
      openEmailId,
      title,
      filterScope: 'starred',
      isStarredView: true,
      empty: (
        <Empty
          icon={Star}
          title={t('mailbox.empty')}
          data-testid="empty-thread-view"
        />
      )
    }),
    [openEmailId, title, t]
  )
  return <EmailList search={search} />
}
