import { EmailOpen } from '@linagora/twake-icons'
import { Box, Empty } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { Navigate, useOutlet, useParams } from 'react-router'

import { FullPageLoader } from '@common/components/FullPageLoader'
import { ListDetailLayout } from '@/ds/ListDetailLayout/ListDetailLayout'
import { LabelList } from '@common/features/labels/LabelList'
import { useLabels, useLabelsAvailable } from '@common/features/labels/queries'
import { useI18n } from '@common/i18n/useI18n'

/**
 * `/label/:labelId`: the emails of a label, and one opened from them
 * (`email/:emailId`); the inbox for a label that is not there (anymore)
 */
export function LabelPage(): ReactElement {
  const { t } = useI18n()
  const { labelId = '' } = useParams()
  const email = useOutlet()
  const isAvailable = useLabelsAvailable()
  const query = useLabels()
  if (!isAvailable) return <Navigate to="/" replace />
  if (query.isPending) return <FullPageLoader />
  const label = query.data?.list.find(candidate => candidate.id === labelId)
  if (!label) return <Navigate to="/" replace />

  return (
    <Box
      className="u-flex u-flex-column u-h-100"
      data-testid="label-page"
      data-label-id={label.id}
    >
      <ListDetailLayout
        list={<LabelList key={label.id} label={label} />}
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
