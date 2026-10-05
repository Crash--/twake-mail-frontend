import { useQueryClient } from '@tanstack/react-query'
import type { Label } from 'jmap-client-ts/linagora'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import { useMatch, useNavigate } from 'react-router'

import { useConfirm } from '@common/features/confirm/ConfirmProvider'
import type { TargetEmail } from '@common/features/emailActions/planEmailChanges'
import { useEmailActions } from '@common/features/emailActions/useEmailActions'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { ChooseLabelsDialog, type LabelChoice } from './ChooseLabelsDialog'
import { LabelDialog } from './LabelDialog'
import { LABEL_PATH } from './labelPaths'
import { labelKeys } from './queries'

export interface LabelActions {
  create: () => void
  edit: (label: Label) => void
  remove: (label: Label) => void
  /**
   * "Label as" on emails shown in `mailboxId` (null elsewhere); resolves
   * to whether their labels changed
   */
  choose: (
    emails: readonly TargetEmail[],
    mailboxId: string | null
  ) => Promise<boolean>
  /** Takes a label off emails (the × of its chip) */
  takeOff: (
    label: Label,
    emails: readonly TargetEmail[],
    mailboxId: string | null
  ) => Promise<boolean>
}

const LabelActionsContext = createContext<LabelActions | null>(null)

type DialogState =
  | { kind: 'edit'; label: Label | null }
  | {
      kind: 'choose'
      emails: readonly TargetEmail[]
      mailboxId: string | null
    }
  | null

export interface LabelActionsProviderProps {
  children: ReactNode
}

/**
 * The label dialogs of the mail screens: create, edit and delete a label
 * (`Label/set`), and "Label as" on emails (their keywords, through the
 * email actions: shown at once, rolled back when refused)
 */
export function LabelActionsProvider({
  children
}: LabelActionsProviderProps): ReactElement {
  const { t } = useI18n()
  const client = useJmapClient()
  const queryClient = useQueryClient()
  const { accountId } = useJmapSession()
  const { notify } = useNotify()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { run } = useEmailActions()
  const openLabelId =
    useMatch(`${LABEL_PATH}/:labelId/*`)?.params.labelId ?? null
  const [dialog, setDialog] = useState<DialogState>(null)
  const pendingChoice = useRef<((done: boolean) => void) | null>(null)

  const apply = useCallback(
    async (
      { added, removed }: LabelChoice,
      emails: readonly TargetEmail[],
      mailboxId: string | null
    ): Promise<boolean> => {
      const results = await Promise.all([
        ...added.map(label =>
          run({ action: 'addLabel', label, emails, mailboxId, silent: true })
        ),
        ...removed.map(label =>
          run({ action: 'removeLabel', label, emails, mailboxId, silent: true })
        )
      ])
      const isDone = results.every(Boolean)
      const [only] = [...added, ...removed]
      notify(
        !isDone
          ? { message: t('labels.errors.addToEmails'), severity: 'error' }
          : added.length + removed.length > 1
            ? { message: t('labels.toasts.updated'), severity: 'success' }
            : {
                message: t(
                  added.length === 1
                    ? emails.length === 1
                      ? 'labels.toasts.addedToEmail'
                      : 'labels.toasts.addedToEmails'
                    : 'labels.toasts.removedFromEmail',
                  { labelName: only?.displayName ?? '' }
                ),
                severity: 'success'
              }
      )
      return isDone
    },
    [run, notify, t]
  )

  const remove = useCallback(
    (label: Label): void => {
      const go = async (): Promise<void> => {
        const isConfirmed = await confirm({
          title: t('labels.delete.title'),
          message: t('labels.delete.message', { labelName: label.displayName }),
          confirmLabel: t('common.delete'),
          isDestructive: true
        })
        if (!isConfirmed) return
        const response = await client.call('Label/set', {
          accountId,
          destroy: [label.id]
        })
        await queryClient.invalidateQueries({
          queryKey: labelKeys.all(accountId)
        })
        if (!response.destroyed?.includes(label.id)) {
          notify({ message: t('labels.errors.delete'), severity: 'error' })
          return
        }
        notify({
          message: t('labels.toasts.deleted', { labelName: label.displayName }),
          severity: 'success'
        })
        if (openLabelId === label.id) void navigate('/')
      }
      go().catch((error: unknown) => {
        console.error('[labels] Cannot delete the label', error)
        notify({ message: t('labels.errors.delete'), severity: 'error' })
      })
    },
    [confirm, client, accountId, queryClient, notify, t, openLabelId, navigate]
  )

  const api = useMemo(
    (): LabelActions => ({
      create: () => {
        setDialog({ kind: 'edit', label: null })
      },
      edit: label => {
        setDialog({ kind: 'edit', label })
      },
      remove,
      choose: (emails, mailboxId) =>
        new Promise(resolve => {
          pendingChoice.current?.(false)
          pendingChoice.current = resolve
          setDialog({ kind: 'choose', emails, mailboxId })
        }),
      takeOff: (label, emails, mailboxId) =>
        apply({ added: [], removed: [label] }, emails, mailboxId)
    }),
    [remove, apply]
  )

  const close = (done: boolean): void => {
    pendingChoice.current?.(done)
    pendingChoice.current = null
    setDialog(null)
  }

  return (
    <LabelActionsContext.Provider value={api}>
      {children}
      {dialog?.kind === 'edit' ? (
        <LabelDialog
          label={dialog.label}
          onClose={() => {
            close(false)
          }}
        />
      ) : null}
      {dialog?.kind === 'choose' ? (
        <ChooseLabelsDialog
          emails={dialog.emails}
          onApply={choice => {
            const { emails, mailboxId } = dialog
            const resolve = pendingChoice.current
            pendingChoice.current = null
            setDialog(null)
            void apply(choice, emails, mailboxId).then(done => {
              resolve?.(done)
            })
          }}
          onClose={() => {
            close(false)
          }}
        />
      ) : null}
    </LabelActionsContext.Provider>
  )
}

const NO_ACTIONS: LabelActions = {
  create: () => undefined,
  edit: () => undefined,
  remove: () => undefined,
  choose: () => Promise.resolve(false),
  takeOff: () => Promise.resolve(false)
}

/** The label actions; none outside the mail screens (tests of a component) */
export function useLabelActions(): LabelActions {
  return useContext(LabelActionsContext) ?? NO_ACTIONS
}
