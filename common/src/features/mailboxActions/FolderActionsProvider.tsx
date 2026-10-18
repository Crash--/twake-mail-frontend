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
  useRef,
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
  mailboxRightsQueryOptions,
  type MailboxSummary
} from '@common/features/mailbox/queries'
import { useMailboxName } from '@common/features/mailbox/useMailboxName'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useRecovery } from '@common/features/recovery/RecoveryProvider'
import { RuleFormDialog } from '@common/features/rules/RuleFormDialog'
import { newRuleDraft } from '@common/features/rules/rules'
import { useAddRule } from '@common/features/rules/useAddRule'
import { threadKeys } from '@common/features/thread/queries'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import {
  focusTargetsAround,
  keepFocusInPage
} from '@common/utils/keepFocusInPage'

import { emailSetBatchSize } from '@common/features/emailActions/sendEmailChanges'

import { destroyMailboxes } from './emptyFolder'
import { useFolderActionProgress } from './FolderActionProgress'
import type { FolderActionId } from './folderActionItems'
import { findClashingParentIds, validateFolderName } from './folderName'
import { MailboxNameDialog } from './MailboxNameDialog'
import { moveFolderContent, undoMoveFolderContent } from './moveFolderContent'
import { SubaddressingDialog } from './SubaddressingDialog'
import { anyoneRightsWith, subaddress, subaddressDetail } from './subaddressing'
import { useCreateFolder } from './useCreateFolder'
import { maxCallsInRequest, useEmptyFolder } from './useEmptyFolder'

export interface FolderActions {
  /**
   * Runs an action of the folder menu (`availableFolderActions`); `opener`,
   * in the row of the folder, tells where the focus goes on when the
   * action removes the row (delete, hide)
   */
  run: (
    id: FolderActionId,
    mailbox: MailboxSummary,
    opener?: Element | null
  ) => void
  /** Creates a folder, under `parentId` (null: the top level) */
  create: (parentId: string | null) => void
  /**
   * Moves a folder under `parentId` (null: the top level), with Undo; what
   * a folder dropped onto another does
   */
  moveUnder: (mailbox: MailboxSummary, parentId: string | null) => void
  /**
   * Calls `listener` each time a folder moved under another, with the ids of
   * the new parent and its ancestors: the tree expands them, so that the
   * user sees where the folder went. Returns the unsubscription
   */
  onMovedUnder: (listener: MovedUnderListener) => () => void
}

export type MovedUnderListener = (parentIds: readonly string[]) => void

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
  const { accountId, session, extraCapabilities } = useJmapSession()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const openMailboxId = useMatch('/mailbox/:mailboxId/*')?.params.mailboxId
  const confirm = useConfirm()
  const pickMailbox = usePickMailbox()
  const emptyFolder = useEmptyFolder()
  const folderProgress = useFolderActionProgress()
  const { run: runEmailAction } = useEmailActions()
  const { notify, dismiss } = useNotify()
  const getName = useMailboxName()
  const [dialog, setDialog] = useState<NameDialog | null>(null)
  const [mailboxes, setMailboxes] = useState<readonly MailboxSummary[]>([])
  const [ruleFolder, setRuleFolder] = useState<MailboxSummary | null>(null)
  /** The folder whose sub-addressing is to be allowed, and its address */
  const [subaddressing, setSubaddressing] = useState<{
    mailbox: MailboxSummary
    address: string
  } | null>(null)
  const addRule = useAddRule()
  const createFolder = useCreateFolder()
  const movedUnderListeners = useRef(new Set<MovedUnderListener>())

  const onMovedUnder = useCallback(
    (listener: MovedUnderListener): (() => void) => {
      const listeners = movedUnderListeners.current
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    []
  )

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
      update: Record<string, PatchObject<Mailbox>>
    }): Promise<void> => {
      const response = await client.call('Mailbox/set', { accountId, ...args })
      assertSetSucceeded(response)
      refreshMailboxes()
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
    const created = await createFolder(name, parentId)
    if (created !== null) {
      void navigate(`/mailbox/${encodeURIComponent(created.id)}`)
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

  const moveUnder = useCallback(
    async (mailbox: MailboxSummary, parentId: string | null): Promise<void> => {
      if (parentId === mailbox.parentId) return
      const list = await loadMailboxes()
      const previousParentId = mailbox.parentId
      try {
        await sendMailboxSet({ update: { [mailbox.id]: { parentId } } })
        if (parentId !== null) {
          const parentIds = [parentId, ...findAncestorIds(list, parentId)]
          movedUnderListeners.current.forEach(listener => {
            listener(parentIds)
          })
        }
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
    [loadMailboxes, t, sendMailboxSet, notify, getName, fail]
  )

  const move = useCallback(
    async (mailbox: MailboxSummary): Promise<void> => {
      const list = await loadMailboxes()
      // As tmail-flutter: "Move To", "All folders" first, the folder and
      // its subfolders faded; so are the places holding a folder of the
      // same name, which the server refuses
      const clashingIds = findClashingParentIds(list, mailbox)
      const destination = await pickMailbox({
        rootLabel: t('mailboxPicker.allFolders'),
        isRootDisabled: clashingIds.includes(null),
        personalOnly: true,
        disabledIds: [
          mailbox.id,
          ...findDescendantIds(list, mailbox.id),
          ...clashingIds.filter(id => id !== null)
        ]
      })
      if (destination === null) return
      await moveUnder(
        mailbox,
        destination === PICKED_ROOT ? null : destination.id
      )
    },
    [loadMailboxes, pickMailbox, t, moveUnder]
  )

  const refreshEmailLists = useCallback(
    (...mailboxIds: string[]): void => {
      for (const mailboxId of mailboxIds) {
        queryClient
          .invalidateQueries({
            queryKey: threadKeys.list(accountId, mailboxId)
          })
          .catch(() => undefined)
      }
      refreshMailboxes()
    },
    [queryClient, accountId, refreshMailboxes]
  )

  const moveContent = useCallback(
    async (mailbox: MailboxSummary): Promise<void> => {
      const list = await loadMailboxes()
      const destination = await pickMailbox({
        currentId: mailbox.id,
        requireAddItems: true
      })
      if (destination === null || destination === PICKED_ROOT) return
      const options = {
        batchSize: emailSetBatchSize(session),
        extraCapabilities
      }
      const total = mailbox.totalEmails
      // One batch goes by too fast to show: a progress only past it
      const progress: { toastId: string | null } = { toastId: null }
      const showProgress = (moved: number): void => {
        progress.toastId = notify({
          message: t('folders.moveContent.progress', { moved, total }),
          severity: 'info',
          duration: null
        })
      }
      if (total > options.batchSize) showProgress(0)
      const result = await moveFolderContent(
        client,
        accountId,
        mailbox.id,
        destination.id,
        {
          ...options,
          markSeen: destination.role === 'junk',
          onProgress: moved => {
            if (total > options.batchSize) showProgress(moved)
          }
        }
      )
      if (progress.toastId !== null) dismiss(progress.toastId)
      refreshEmailLists(mailbox.id, destination.id)
      if (result.error !== null || result.failedCount > 0) {
        if (result.error !== null) {
          console.error(
            '[mailbox] Cannot move the folder content',
            result.error
          )
        }
        notify({ message: t('folders.moveContent.failure'), severity: 'error' })
        return
      }
      notify({
        message: t('emailActions.toast.movedTo', {
          destinationMailboxPath: mailboxPath(list, destination.id, getName)
        }),
        severity: 'success',
        action: {
          label: t('common.undo'),
          isUndo: true,
          onClick: () => {
            undoMoveFolderContent(
              client,
              accountId,
              result.movedIds,
              mailbox.id,
              destination.id,
              options
            )
              .then(isUndone => {
                if (!isUndone) fail('common.unknownError', null)
                refreshEmailLists(mailbox.id, destination.id)
              })
              .catch((error: unknown) => {
                fail('common.unknownError', error)
              })
          },
          'data-testid': 'toast-undo-button'
        }
      })
    },
    [
      loadMailboxes,
      pickMailbox,
      session,
      extraCapabilities,
      notify,
      dismiss,
      t,
      client,
      accountId,
      refreshEmailLists,
      getName,
      fail
    ]
  )

  const remove = useCallback(
    async (mailbox: MailboxSummary, opener: Element | null): Promise<void> => {
      const focusTargets = focusTargetsAround(opener)
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
        keepFocusInPage(focusTargets)
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
      // As tmail-flutter: one long folder action at a time, its progress
      // above the list, sliding while the unread emails are fetched
      const isStarted = folderProgress.start({
        kind: 'markAsRead',
        mailboxId: mailbox.id,
        folderName,
        total: null
      })
      if (!isStarted) return
      try {
        const emails = await fetchMailboxEmails(client, accountId, mailbox.id, {
          filter: { notKeyword: '$seen' }
        })
        folderProgress.update(0, emails.length)
        const done = await runEmailAction({
          action: 'markAsRead',
          emails,
          mailboxId: mailbox.id,
          silent: true,
          onProgress: folderProgress.update
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
      } finally {
        folderProgress.finish()
      }
    },
    [getName, folderProgress, client, accountId, runEmailAction, notify, t]
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
    async (mailbox: MailboxSummary, opener: Element | null): Promise<void> => {
      const focusTargets = focusTargetsAround(opener)
      const list = await fetchMailboxes()
      const ids = [mailbox.id, ...findDescendantIds(list, mailbox.id)]
      try {
        await setSubscribed(ids, false)
        keepFocusInPage(focusTargets)
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

  /** The sub-address of a folder, null (said) when it cannot be written */
  const subaddressOf = useCallback(
    async (mailbox: MailboxSummary): Promise<string | null> => {
      const detail = subaddressDetail(await loadMailboxes(), mailbox.id)
      const address =
        detail === null ? null : subaddress(session.username, detail)
      if (address === null) {
        notify({
          message: t('folders.subaddressing.addressFailed'),
          severity: 'error'
        })
      }
      return address
    },
    [loadMailboxes, session.username, notify, t]
  )

  const copySubaddress = useCallback(
    (address: string): void => {
      navigator.clipboard
        .writeText(address)
        .then(() => {
          notify({
            message: t('folders.subaddressing.copied'),
            severity: 'success'
          })
        })
        .catch((error: unknown) => {
          console.warn('[mailbox] Cannot copy the subaddress', error)
        })
    },
    [notify, t]
  )

  /**
   * Gives anyone the right to post in the folder, or takes it back: the
   * other rights of `anyone`, read afresh, stay
   */
  const changeSubaddressing = useCallback(
    async (mailbox: MailboxSummary, isAllowed: boolean): Promise<void> => {
      const options = mailboxRightsQueryOptions(client, accountId, mailbox.id)
      try {
        const rights = await queryClient.query({ ...options, staleTime: 0 })
        await sendMailboxSet({
          update: {
            [mailbox.id]: {
              'sharedWith/anyone': anyoneRightsWith(rights, isAllowed)
            }
          }
        })
        await queryClient.invalidateQueries({ queryKey: options.queryKey })
        notify({
          message: t(
            isAllowed
              ? 'folders.subaddressing.allowed'
              : 'folders.subaddressing.disallowed'
          ),
          severity: 'success'
        })
      } catch (error: unknown) {
        fail('folders.subaddressing.failed', error)
      }
    },
    [client, accountId, queryClient, sendMailboxSet, notify, t, fail]
  )

  const run = useCallback(
    (
      id: FolderActionId,
      mailbox: MailboxSummary,
      opener: Element | null = null
    ): void => {
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
        case 'move-content':
          void moveContent(mailbox)
          return
        case 'create-filter':
          setRuleFolder(mailbox)
          return
        case 'open-in-new-tab':
          // A link of the menu: the browser opens it
          return
        case 'delete':
          void remove(mailbox, opener)
          return
        case 'mark-as-read':
          void markAsRead(mailbox)
          return
        case 'hide':
          void hide(mailbox, opener)
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
          return
        case 'allow-subaddressing':
          void subaddressOf(mailbox).then(address => {
            if (address !== null) setSubaddressing({ mailbox, address })
          })
          return
        case 'disallow-subaddressing':
          void changeSubaddressing(mailbox, false)
          return
        case 'copy-subaddress':
          void subaddressOf(mailbox).then(address => {
            if (address !== null) copySubaddress(address)
          })
      }
    },
    [
      create,
      loadMailboxes,
      move,
      moveContent,
      remove,
      markAsRead,
      hide,
      show,
      emptyFolder,
      recovery,
      subaddressOf,
      changeSubaddressing,
      copySubaddress
    ]
  )

  const api = useMemo<FolderActions>(
    () => ({
      run,
      create,
      moveUnder: (mailbox, parentId) => {
        moveUnder(mailbox, parentId).catch((error: unknown) => {
          fail('common.unknownError', error)
        })
      },
      onMovedUnder
    }),
    [run, create, moveUnder, fail, onMovedUnder]
  )

  const handleClose = (): void => {
    setDialog(null)
  }

  let dialogElement: ReactElement | null = null
  if (dialog?.mode === 'create') {
    const { parentId } = dialog
    const changeLocation = (): void => {
      // As tmail-flutter: "All folders" first, the location chosen checked
      void pickMailbox({
        title: t('mailboxPicker.selectParent'),
        rootLabel: t('mailboxPicker.allFolders'),
        personalOnly: true,
        currentId: parentId ?? PICKED_ROOT
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
              ? t('mailboxPicker.allFolders')
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
      {subaddressing === null ? null : (
        <SubaddressingDialog
          folderName={getName(subaddressing.mailbox)}
          address={subaddressing.address}
          onCopy={() => {
            copySubaddress(subaddressing.address)
          }}
          onAllow={() => {
            setSubaddressing(null)
            void changeSubaddressing(subaddressing.mailbox, true)
          }}
          onClose={() => {
            setSubaddressing(null)
          }}
        />
      )}
      {ruleFolder === null ? null : (
        <RuleFormDialog
          rule={null}
          initialDraft={newRuleDraft(null, ruleFolder)}
          onSubmit={async rule => {
            const isAdded = await addRule(rule)
            if (isAdded) setRuleFolder(null)
            return isAdded
          }}
          onClose={() => {
            setRuleFolder(null)
          }}
        />
      )}
    </FolderActionsContext.Provider>
  )
}

const NO_FOLDER_ACTIONS: FolderActions = {
  run: () => undefined,
  create: () => undefined,
  moveUnder: () => undefined,
  onMovedUnder: () => () => undefined
}

/** The folder actions; without their provider (tests), none */
export function useFolderActions(): FolderActions {
  return useContext(FolderActionsContext) ?? NO_FOLDER_ACTIONS
}
