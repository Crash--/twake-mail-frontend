import { EmailOpen } from '@linagora/twake-icons'
import { Box, Empty } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { Navigate, useOutlet } from 'react-router'

import { ListDetailLayout } from '@/ds/ListDetailLayout/ListDetailLayout'
import { useAiNeedsAction } from '@common/features/ai/aiNeedsAction'
import { ActionRequiredList } from '@common/features/mailbox/ActionRequiredList'
import { useI18n } from '@common/i18n/useI18n'

/**
 * `/action-required`: the emails needing an action, and one opened from
 * them (`email/:emailId`), instead of the list or beside it. Without the
 * feature (no AI capability, or label categorisation off) it goes back to
 * the default folder, as tmail-flutter does when the folder goes away.
 */
export function ActionRequiredPage(): ReactElement | null {
  const { t } = useI18n()
  const email = useOutlet()
  const { isEnabled, isSettled } = useAiNeedsAction()

  if (!isSettled) return null
  if (!isEnabled) return <Navigate to="/" replace />

  return (
    <Box
      className="u-flex u-flex-column u-h-100"
      data-testid="action-required-page"
    >
      <ListDetailLayout
        list={<ActionRequiredList />}
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
