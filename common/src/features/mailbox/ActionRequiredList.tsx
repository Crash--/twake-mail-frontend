import { useMemo, type ReactElement } from 'react'
import { useMatch } from 'react-router'

import { EmptyListView } from '@/ds/EmptyListView/EmptyListView'

import { NEEDS_ACTION, SEEN } from '@common/features/email/keywords'
import {
  EmailList,
  type EmailListSearch
} from '@common/features/thread/EmailList'
import { useI18n } from '@common/i18n/useI18n'

import { ACTION_REQUIRED_PATH } from './ActionRequiredTreeItem'

/** The path of an email needing an action, opened beside or instead of the list */
export function actionRequiredEmailPath(emailId: string): string {
  return `${ACTION_REQUIRED_PATH}/email/${encodeURIComponent(emailId)}`
}

/**
 * The unread emails with the `needs-action` keyword, from every folder,
 * most recent first: tmail-flutter's "Action required" virtual folder.
 * Push keeps it up to date, as search results.
 */
export function ActionRequiredList(): ReactElement {
  const { t } = useI18n()
  const openEmailId =
    useMatch(`${ACTION_REQUIRED_PATH}/email/:emailId`)?.params.emailId ?? null
  const title = t('mailbox.actionRequired')
  const search = useMemo(
    (): EmailListSearch => ({
      request: {
        filter: { hasKeyword: NEEDS_ACTION, notKeyword: SEEN },
        sort: [{ property: 'receivedAt', isAscending: false }]
      },
      emailPath: actionRequiredEmailPath,
      openEmailId,
      title,
      filterScope: 'action-required',
      isActionRequiredView: true,
      empty: (
        <EmptyListView
          title={t('mailbox.emptyActionRequired')}
          text={t('mailbox.emptyHint')}
          data-testid="empty-thread-view"
        />
      )
    }),
    [openEmailId, title, t]
  )
  return <EmailList search={search} />
}
