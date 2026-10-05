import { useQueryClient } from '@tanstack/react-query'
import {
  assertSetSucceeded,
  type Mailbox,
  type PatchObject
} from 'jmap-client-ts'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import { useMatch, useNavigate } from 'react-router'

import { useConfirm } from '@common/features/confirm/ConfirmProvider'
import { fetchMailboxEmails } from '@common/features/emailActions/mailboxEmails'
import { useEmailActions } from '@common/features/emailActions/useEmailActions'
import {
  PICKED_ROOT,
  usePickMailbox
} from '@common/features/mailbox/MailboxPickerProvider'
import {
  findAncestorIds,
  findDescendantIds,
  findMailboxIdByRole,
  mailboxPath
} from '@common/features/mailbox/mailboxTree'
import {
  mailboxesQueryOptions,
  mailboxKeys,
  type MailboxSummary
} from '@common/features/mailbox/queries'
import { useMailboxName } from '@common/features/mailbox/useMailboxName'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useRecovery } from '@common/features/recovery/RecoveryProvider'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { destroyMailboxes } from './emptyFolder'
import type { FolderActionId } from './folderActionItems'
import { validateFolderName } from './folderName'
import { MailboxNameDialog } from './MailboxNameDialog'
import { maxCallsInRequest, useEmptyFolder } from './useEmptyFolder'

export interface FolderActions {
  /** Runs an action of the folder menu (`availableFolderActions`) */
  run: (id: FolderActionId, mailbox: MailboxSummary) => void
  /** Creates a folder, under `parentId` (null: the top level) */
  create: (parentId: string | null) => void
}

const FolderActionsContext = createContext<FolderActions | null>(null)

type NameDialog =
  | { mode: 'create'; parentId: string | null }
  | { mode: 'rename'; mailbox: MailboxSummary }

export interface FolderActionsProviderProps {
  children: ReactNode
}

/**
 * The folder actions of the tree, as tmail-flutter: create (a dialog with
 * the name and where it goes), rename, move (the folder picker, the top
 * level being "All folders"), delete with its subfolders and emails after a
 * confirmation, mark every email read, hide and show, empty the Trash and
 * Spam. Each change goes through `Mailbox/set`; the tree follows by push,
 * and is refetched at once.
 */
export function FolderActionsProvider({
  children
}: FolderActionsProviderProps): ReactElement {
  const { t } = useI18n()
  const recovery = useRecovery()
  const client = useJmapClient()
  const { accountId, session } = useJmapSession()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const openMailboxId = useMatch('/mailbox/:mailboxId/*')?.params.mailboxId
  const confirm = useConfirm()
  const pickMailbox = usePickMailbox()
  const emptyFolder = useEmptyFolder()
  const { run: runEmailAction } = useEmailActions()
  const { notify } = useNotify()
  const getName = useMailboxName()
  const [dialog, setDialog] = useState<NameDialog | null>(null)
  const [mailboxes, setMailboxes] = useState<readonly MailboxSummary[]>([])

  const loadMailboxes = useCallback(async (): Promise<MailboxSummary[]> => {
    const data = await queryClient.query({
      ...mailboxesQueryOptions(client, accountId),
      staleTime: Infinity
    })
    return data.list
  }, [queryClient, client, accountId])

  /**
   * The folders as the server has them now: the subfolders another client
   * created since the last push must go (delete) or hide with their parent
   */
  const fetchMailboxes = useCallback(async (): Promise<MailboxSummary[]> => {
    const data = await queryClient.query({
      ...mailboxesQueryOptions(client, accountId),
      staleTime: 0
    })
    return data.list
  }, [queryClient, client, accountId])

  const refreshMailboxes = useCallback((): void => {
    queryClient
      .invalidateQueries({ queryKey: mailboxKeys.list(accountId) })
      .catch(() => undefined)
  }, [queryClient, accountId])

  /** One `Mailbox/set`; throws when the server refuses any part of it */
  const sendMailboxSet = useCallback(
    async (args: {
      create?: Record<
        string,
        { name: string; parentId: string | null; isSubscribed: boolean }
      >
      update?: Record<string, PatchObject<Mailbox>>
    }): Promise<Record<string, { id: string }>> => {
      const response = await client.call('Mailbox/set', { accountId, ...args })
      assertSetSucceeded(response)
      refreshMailboxes()
      const created: Record<string, { id: string }> = {}
      for (const [key, value] of Object.entries(response.created ?? {})) {
        created[key] = { id: value.id }
      }
      return created
    },
    [client, accountId, refreshMailboxes]
  )

  const fail = useCallback(
    (key: TranslationKey, error: unknown): void => {
      console.error('[mailbox] Folder action failed', error)
      notify({ message: t(key), severity: 'error' })
    },
    [notify, t]
  )

  const create = useCallback(
    (parentId: string | null): void => {
      void loadMailboxes().then(list => {
        setMailboxes(list)
        setDialog({ mode: 'create', parentId })
      })
    },
    [loadMailboxes]
  )

  const handleCreate = async (
    name: string,
    parentId: string | null
  ): Promise<void> => {
    setDialog(null)
    try {
      const created = await sendMailboxSet({
        create: { folder: { name, parentId, isSubscribed: true } }
      })
      notify({
        message: t('folders.create.success', { folderName: name }),
        severity: 'success'
      })
      const id = created.folder?.id
      // The folder must be known before the app shows it: no redirection
      await queryClient
        .invalidateQueries({ queryKey: mailboxKeys.list(accountId) })
        .catch(() => undefined)
      if (id !== undefined) void navigate(`/mailbox/${encodeURIComponent(id)}`)
    } catch (error: unknown) {
      fail('folders.create.failure', error)
    }
  }

  const handleRename = async (
    name: string,
    mailbox: MailboxSummary
  ): Promise<void> => {
    setDialog(null)
    try {
      await sendMailboxSet({ update: { [mailbox.id]: { name } } })
    } catch (error: unknown) {
      fail('folders.rename.failure', error)
    }
  }

  const move = useCallback(
    async (mailbox: MailboxSummary): Promise<void> => {
      const list = await loadMailboxes()
      const destination = await pickMailbox({
        title: t('folders.menu.move'),
        rootLabel: t('mailboxPicker.allFolders'),
        personalOnly: true,
        disabledIds: [mailbox.id, ...findDescendantIds(list, mailbox.id)]
      })
      if (destination === null) return
      const parentId = destination === PICKED_ROOT ? null : destination.id
      if (parentId === mailbox.parentId) return
      const previousParentId = mailbox.parentId
      try {
        await sendMailboxSet({ update: { [mailbox.id]: { parentId } } })
        notify({
          message: t('emailActions.toast.movedTo', {
            destinationMailboxPath:
              parentId === null
                ? t('mailboxPicker.allFolders')
                : mailboxPath(list, parentId, getName)
          }),
          severity: 'success',
          action: {
            label: t('common.undo'),
            isUndo: true,
            onClick: () => {
              sendMailboxSet({
                update: { [mailbox.id]: { parentId: previousParentId } }
              }).catch((error: unknown) => {
                fail('common.unknownError', error)
              })
            },
            'data-testid': 'toast-undo-button'
          }
        })
      } catch (error: unknown) {
        fail('common.unknownError', error)
      }
    },
    [loadMailboxes, pickMailbox, t, sendMailboxSet, notify, getName, fail]
  )

  const remove = useCallback(
    async (mailbox: MailboxSummary): Promise<void> => {
      const confirmed = await confirm({
        title: t('folders.delete.title'),
        message: t('folders.delete.message', { nameMailbox: getName(mailbox) }),
        confirmLabel: t('common.delete'),
        isDestructive: true
      })
      if (!confirmed) return
      const list = await fetchMailboxes()
      const ids = [...findDescendantIds(list, mailbox.id), mailbox.id]
      try {
        const failed = await destroyMailboxes(client, accountId, ids, {
          maxCalls: maxCallsInRequest(session.capabilities)
        })
        refreshMailboxes()
        if (failed.length > 0) {
          fail('folders.delete.failure', failed)
          return
        }
        notify({ message: t('folders.delete.success'), severity: 'success' })
        // The open folder went: back to the Inbox, as tmail-flutter
        const inboxId = findMailboxIdByRole(list, 'inbox')
        if (
          openMailboxId !== undefined &&
          ids.includes(openMailboxId) &&
          inboxId !== null
        ) {
          void navigate(`/mailbox/${encodeURIComponent(inboxId)}`)
        }
      } catch (error: unknown) {
        fail('folders.delete.failure', error)
      }
    },
    [
      confirm,
      t,
      getName,
      fetchMailboxes,
      client,
      accountId,
      session,
      refreshMailboxes,
      fail,
      notify,
      openMailboxId,
      navigate
    ]
  )

  const markAsRead = useCallback(
    async (mailbox: MailboxSummary): Promise<void> => {
      const folderName = getName(mailbox)
      try {
        const emails = await fetchMailboxEmails(client, accountId, mailbox.id, {
          filter: { notKeyword: '$seen' }
        })
        const done = await runEmailAction({
          action: 'markAsRead',
          emails,
          mailboxId: mailbox.id,
          silent: true
        })
        if (!done) throw new Error('Some emails were not marked read')
        notify({
          message: t('folders.markAsRead.success', { mailboxName: folderName }),
          severity: 'success'
        })
      } catch (error: unknown) {
        console.error('[mailbox] Cannot mark the folder read', error)
        notify({
          message: t('folders.markAsRead.failure', { folderName }),
          severity: 'error'
        })
      }
    },
    [getName, client, accountId, runEmailAction, notify, t]
  )

  const setSubscribed = useCallback(
    async (ids: readonly string[], isSubscribed: boolean): Promise<void> => {
      await sendMailboxSet({
        update: Object.fromEntries(ids.map(id => [id, { isSubscribed }]))
      })
    },
    [sendMailboxSet]
  )

  const hide = useCallback(
    async (mailbox: MailboxSummary): Promise<void> => {
      const list = await fetchMailboxes()
      const ids = [mailbox.id, ...findDescendantIds(list, mailbox.id)]
      try {
        await setSubscribed(ids, false)
        notify({
          message: t('folders.hide.success'),
          severity: 'success',
          action: {
            label: t('common.undo'),
            isUndo: true,
            onClick: () => {
              setSubscribed(ids, true).catch((error: unknown) => {
                fail('common.unknownError', error)
              })
            },
            'data-testid': 'toast-undo-button'
          }
        })
      } catch (error: unknown) {
        fail('common.unknownError', error)
      }
    },
    [fetchMailboxes, setSubscribed, notify, t, fail]
  )

  const show = useCallback(
    async (mailbox: MailboxSummary): Promise<void> => {
      const list = await loadMailboxes()
      const ids = [mailbox.id, ...findAncestorIds(list, mailbox.id)]
      try {
        await setSubscribed(ids, true)
        notify({ message: t('folders.show.success'), severity: 'success' })
      } catch (error: unknown) {
        fail('common.unknownError', error)
      }
    },
    [loadMailboxes, setSubscribed, notify, t, fail]
  )

  const run = useCallback(
    (id: FolderActionId, mailbox: MailboxSummary): void => {
      switch (id) {
        case 'new-subfolder':
          create(mailbox.id)
          return
        case 'rename':
          void loadMailboxes().then(list => {
            setMailboxes(list)
            setDialog({ mode: 'rename', mailbox })
          })
          return
        case 'move':
          void move(mailbox)
          return
        case 'delete':
          void remove(mailbox)
          return
        case 'mark-as-read':
          void markAsRead(mailbox)
          return
        case 'hide':
          void hide(mailbox)
          return
        case 'show':
          void show(mailbox)
          return
        case 'empty-trash':
        case 'empty-spam':
          void emptyFolder(mailbox)
          return
        case 'recover-deleted-messages':
          recovery.open()
      }
    },
    [
      create,
      loadMailboxes,
      move,
      remove,
      markAsRead,
      hide,
      show,
      emptyFolder,
      recovery
    ]
  )

  const api = useMemo<FolderActions>(() => ({ run, create }), [run, create])

  const handleClose = (): void => {
    setDialog(null)
  }

  let dialogElement: ReactElement | null = null
  if (dialog?.mode === 'create') {
    const { parentId } = dialog
    const changeLocation = (): void => {
      void pickMailbox({
        title: t('folders.create.location'),
        rootLabel: t('mailboxPicker.personalFolders'),
        personalOnly: true
      }).then(destination => {
        if (destination === null) return
        setDialog({
          mode: 'create',
          parentId: destination === PICKED_ROOT ? null : destination.id
        })
      })
    }
    dialogElement = (
      <MailboxNameDialog
        title={t('folders.create.title')}
        submitLabel={t('folders.create.submit')}
        initialName=""
        location={{
          path:
            parentId === null
              ? t('mailboxPicker.personalFolders')
              : mailboxPath(mailboxes, parentId, getName),
          onChange: changeLocation
        }}
        validate={name => validateFolderName(name, { mailboxes, parentId })}
        onSubmit={name => {
          void handleCreate(name, parentId)
        }}
        onClose={handleClose}
      />
    )
  } else if (dialog?.mode === 'rename') {
    const { mailbox } = dialog
    dialogElement = (
      <MailboxNameDialog
        key={mailbox.id}
        title={t('folders.menu.rename')}
        submitLabel={t('folders.rename.submit')}
        initialName={mailbox.name}
        validate={name =>
          validateFolderName(name, {
            mailboxes,
            parentId: mailbox.parentId,
            renamedId: mailbox.id
          })
        }
        onSubmit={name => {
          void handleRename(name, mailbox)
        }}
        onClose={handleClose}
      />
    )
  }

  return (
    <FolderActionsContext.Provider value={api}>
      {children}
      {dialogElement}
    </FolderActionsContext.Provider>
  )
}

const NO_FOLDER_ACTIONS: FolderActions = {
  run: () => undefined,
  create: () => undefined
}

/** The folder actions; without their provider (tests), none */
export function useFolderActions(): FolderActions {
  return useContext(FolderActionsContext) ?? NO_FOLDER_ACTIONS
}
