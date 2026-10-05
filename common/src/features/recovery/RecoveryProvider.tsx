import { Alert } from '@linagora/twake-mui'
import { useQueryClient } from '@tanstack/react-query'
import {
  LINAGORA_CAPABILITIES,
  type MessagesVaultCapability
} from 'jmap-client-ts/linagora'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import { useNavigate } from 'react-router'

import { findMailboxIdByRole } from '@common/features/mailbox/mailboxTree'
import {
  mailboxesQueryOptions,
  mailboxKeys
} from '@common/features/mailbox/queries'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { horizonDays, recoveryCriteria, type RecoveryForm } from './recovery'
import { RecoveryDialog } from './RecoveryDialog'

/** The role tmail-backend gives the folder of the restored emails */
export const RESTORED_ROLE = 'restored messages'

const POLL_INTERVAL_MS = 2_000

export interface Recovery {
  /** Whether the server keeps deleted emails in a vault */
  isAvailable: boolean
  open: () => void
  /** A recovery is running */
  isRunning: boolean
}

const RecoveryContext = createContext<Recovery | null>(null)

export interface RecoveryProviderProps {
  children: ReactNode
  /** How often the task is read (tests) */
  pollIntervalMs?: number
}

/**
 * The recovery of deleted emails (`EmailRecoveryAction`, vault): its form,
 * then the task followed every 2 s until it ends, as tmail-flutter does,
 * with a toast opening the "Recovered" folder
 */
export function RecoveryProvider({
  children,
  pollIntervalMs = POLL_INTERVAL_MS
}: RecoveryProviderProps): ReactElement {
  const { t } = useI18n()
  const client = useJmapClient()
  const queryClient = useQueryClient()
  const { accountId, session } = useJmapSession()
  const { notify } = useNotify()
  const navigate = useNavigate()
  const vault = session.capabilities[LINAGORA_CAPABILITIES.messagesVault] as
    MessagesVaultCapability | undefined
  const [isOpen, setIsOpen] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)

  const start = useCallback(
    async (form: RecoveryForm): Promise<boolean> => {
      const response = await client.call('EmailRecoveryAction/set', {
        accountId,
        create: { recovery: recoveryCriteria(form, new Date()) }
      })
      const created = response.created?.recovery
      if (!created) return false
      setTaskId(created.id)
      return true
    },
    [client, accountId]
  )

  const finish = useCallback(
    async (status: string, restored: number): Promise<void> => {
      setTaskId(null)
      if (status !== 'completed') {
        notify({
          message: t(
            status === 'canceled'
              ? 'recovery.toasts.canceled'
              : 'recovery.toasts.failed'
          ),
          severity: 'error'
        })
        return
      }
      await queryClient.invalidateQueries({
        queryKey: mailboxKeys.all(accountId)
      })
      const mailboxes = await queryClient
        .query({ ...mailboxesQueryOptions(client, accountId), staleTime: 0 })
        .then(data => data.list)
        .catch(() => [])
      const folderId = findMailboxIdByRole(mailboxes, RESTORED_ROLE)
      notify({
        message:
          restored > 0
            ? t('recovery.toasts.successCount', { smart_count: restored })
            : t('recovery.toasts.success'),
        severity: 'success',
        action:
          folderId === null
            ? null
            : {
                label: t('common.open'),
                onClick: () => {
                  void navigate(`/mailbox/${encodeURIComponent(folderId)}`)
                },
                'data-testid': 'recovery-open-button'
              }
      })
    },
    [client, accountId, queryClient, notify, navigate, t]
  )

  useEffect(() => {
    if (taskId === null) return
    const stop = new AbortController()
    const isStopped = (): boolean => stop.signal.aborted
    const poll = async (): Promise<void> => {
      while (!isStopped()) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
        if (isStopped()) return
        try {
          const { list } = await client.call('EmailRecoveryAction/get', {
            accountId,
            ids: [taskId],
            properties: ['status', 'successfulRestoreCount']
          })
          const action = list.at(0)
          if (!action) {
            void finish('failed', 0)
            return
          }
          if (action.status !== 'waiting' && action.status !== 'inProgress') {
            void finish(action.status, action.successfulRestoreCount)
            return
          }
        } catch (error: unknown) {
          console.warn('[recovery] Cannot follow the recovery', error)
        }
      }
    }
    void poll()
    return () => {
      stop.abort()
    }
  }, [taskId, client, accountId, finish, pollIntervalMs])

  const api = useMemo(
    (): Recovery => ({
      isAvailable: vault !== undefined,
      open: () => {
        setIsOpen(true)
      },
      isRunning: taskId !== null
    }),
    [vault, taskId]
  )

  return (
    <RecoveryContext.Provider value={api}>
      {children}
      {isOpen ? (
        <RecoveryDialog
          horizon={horizonDays(vault?.restorationHorizon)}
          onSubmit={start}
          onClose={() => {
            setIsOpen(false)
          }}
        />
      ) : null}
    </RecoveryContext.Provider>
  )
}

const NO_RECOVERY: Recovery = {
  isAvailable: false,
  open: () => undefined,
  isRunning: false
}

export function useRecovery(): Recovery {
  return useContext(RecoveryContext) ?? NO_RECOVERY
}

/** Says a recovery runs, above the mail (tmail-flutter's progress banner) */
export function RecoveryBanner(): ReactElement | null {
  const { t } = useI18n()
  const { isRunning } = useRecovery()
  if (!isRunning) return null
  return (
    <Alert severity="info" className="u-m-1" data-testid="recovery-banner">
      {t('recovery.inProgress')}
    </Alert>
  )
}
