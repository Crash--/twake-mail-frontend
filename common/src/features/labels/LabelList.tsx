import { Label as LabelGlyph } from '@linagora/twake-icons'
import { Empty } from '@linagora/twake-mui'
import type { Label } from 'jmap-client-ts/linagora'
import { useMemo, type ReactElement } from 'react'
import { useMatch } from 'react-router'

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
        sort: [{ property: 'receivedAt', isAscending: false }]
      },
      emailPath: emailId => labelEmailPath(label.id, emailId),
      openEmailId,
      title: label.displayName,
      empty: (
        <Empty
          icon={LabelGlyph}
          title={t('labels.emptyView')}
          data-testid="empty-thread-view"
        />
      )
    }),
    [label, openEmailId, t]
  )
  return <EmailList search={search} />
}
