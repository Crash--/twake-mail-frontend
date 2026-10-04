import { useCallback } from 'react'

import { useI18n } from '@common/i18n/useI18n'

import { getRoleNameKey } from './mailboxDisplay'
import type { MailboxSummary } from './queries'

/**
 * Display name of a mailbox: the translated name of system folders, the
 * name given by the user otherwise.
 */
export function useMailboxName(): (
  mailbox: Pick<MailboxSummary, 'name' | 'role'>
) => string {
  const { t } = useI18n()
  return useCallback(
    mailbox => {
      const key = getRoleNameKey(mailbox)
      return key ? t(key) : mailbox.name
    },
    [t]
  )
}
