import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { useOutlet } from 'react-router'

import { DetailPlaceholder } from '@/ds/DetailPlaceholder/DetailPlaceholder'
import { ListDetailLayout } from '@/ds/ListDetailLayout/ListDetailLayout'
import { StarredList } from '@common/features/mailbox/StarredList'
import { useI18n } from '@common/i18n/useI18n'

/**
 * `/starred`: the starred emails, and one opened from them
 * (`email/:emailId`), instead of the list or beside it.
 */
export function StarredPage(): ReactElement {
  const { t } = useI18n()
  const email = useOutlet()

  return (
    <Box className="u-flex u-flex-column u-h-100" data-testid="starred-page">
      <ListDetailLayout
        list={<StarredList />}
        detail={email}
        placeholder={
          <DetailPlaceholder
            title={t('email.noneSelected')}
            data-testid="email-view-empty"
          />
        }
      />
    </Box>
  )
}
