import { useQueryClient } from '@tanstack/react-query'
import { JmapMethodError } from 'jmap-client-ts'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'

import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import {
  useJmapSession,
  useMailboxView
} from '@common/jmap/JmapSessionProvider'
import { reloadSession } from '@common/jmap/queries'

import { useContactName } from './useContactNames'

/** What James answers on an account the user may no longer reach */
const NO_ACCESS_ERRORS = ['accountNotFound', 'forbidden']

/**
 * A delegated mailbox taken back from the user while shown: a request
 * refused on its account reads the session again (the regular catching up
 * does too), whose new list of accounts gives the user's own mailbox back
 * (`JmapSessionProvider`); then they land on their Inbox, told why.
 */
export function DelegatedAccessGuard(): null {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { notify } = useNotify()
  const client = useJmapClient()
  const queryClient = useQueryClient()
  const { accountId, ownAccountId } = useJmapSession()
  const { lostAccess, dismissLostAccess } = useMailboxView()
  const isDelegated = accountId !== ownAccountId
  // The owner as the mailbox switcher named them, not by their address
  const ownerName = useContactName(lostAccess?.name ?? null)

  useEffect(() => {
    if (!isDelegated) return undefined
    return queryClient.getQueryCache().subscribe(event => {
      if (event.type !== 'updated' || event.action.type !== 'error') return
      const error: unknown = event.action.error
      if (
        !(error instanceof JmapMethodError) ||
        !NO_ACCESS_ERRORS.includes(error.type)
      ) {
        return
      }
      reloadSession(client, queryClient).catch((reason: unknown) => {
        console.error('[delegation] Cannot read the session again', reason)
      })
    })
  }, [isDelegated, client, queryClient])

  useEffect(() => {
    if (lostAccess === null) return
    // Once their name is known (the contacts went with the delegated cache)
    if (lostAccess.name !== null && ownerName === null) return
    dismissLostAccess()
    void navigate('/', { replace: true })
    notify({
      message:
        ownerName === null
          ? t('delegation.toasts.lostAccess')
          : t('delegation.toasts.left', { name: ownerName }),
      severity: 'info'
    })
  }, [lostAccess, ownerName, dismissLostAccess, navigate, notify, t])

  return null
}
