import { Folder } from '@linagora/twake-icons'
import { Empty } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { Navigate } from 'react-router'

import { ErrorScreen } from '@common/components/ErrorScreen'
import { FullPageLoader } from '@common/components/FullPageLoader'
import { useI18n } from '@common/i18n/useI18n'

import { findMailboxIdByRole } from './mailboxTree'
import { useMailboxes } from './useMailboxes'

/**
 * The page the app opens on: the inbox, resolved from the mailboxes.
 */
export function DefaultMailboxRedirect(): ReactElement {
  const { t } = useI18n()
  const query = useMailboxes()

  if (query.isPending) return <FullPageLoader />

  if (query.isError) {
    const handleRetry = (): void => {
      void query.refetch()
    }
    return (
      <ErrorScreen
        title={t('common.errorOccurred')}
        actionLabel={t('common.retry')}
        onAction={handleRetry}
        data-testid="mailboxes-error"
      />
    )
  }

  const mailboxId =
    findMailboxIdByRole(query.data, 'inbox') ?? query.data[0]?.id ?? null
  if (mailboxId === null) {
    return <Empty icon={Folder} title={t('mailbox.empty')} />
  }
  return <Navigate to={`/mailbox/${encodeURIComponent(mailboxId)}`} replace />
}
