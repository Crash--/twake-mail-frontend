import type { Label } from 'jmap-client-ts/linagora'
import { useMemo, type ReactElement } from 'react'
import { useMatch } from 'react-router'

import { EmptyListView } from '@/ds/EmptyListView/EmptyListView'

import {
  EmailList,
  type EmailListSearch
} from '@common/features/thread/EmailList'
import { useI18n } from '@common/i18n/useI18n'

import { LABEL_PATH, labelEmailPath } from './labelPaths'

export interface LabelListProps {
  label: Label
}

/**
 * The emails of a label, from every folder (their folder named in the
 * rows), most recent first: tmail-flutter's label view (`hasKeyword`)
 */
export function LabelList({ label }: LabelListProps): ReactElement {
  const { t } = useI18n()
  const openEmailId =
    useMatch(`${LABEL_PATH}/:labelId/email/:emailId`)?.params.emailId ?? null
  const search = useMemo(
    (): EmailListSearch => ({
      request: {
        filter: { hasKeyword: label.keyword },
        sort: [{ property: 'receivedAt', isAscending: false }],
        // An email the label is taken off leaves the view
        isListFiltered: true
      },
      emailPath: emailId => labelEmailPath(label.id, emailId),
      openEmailId,
      title: label.displayName,
      filterScope: `label:${label.id}`,
      empty: (
        <EmptyListView
          title={t('labels.emptyView')}
          text={t('mailbox.emptyHint')}
          data-testid="empty-thread-view"
        />
      )
    }),
    [label, openEmailId, t]
  )
  return <EmailList search={search} />
}
