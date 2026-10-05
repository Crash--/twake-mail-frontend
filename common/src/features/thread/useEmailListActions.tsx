import type { VirtualizedTableRow } from '@linagora/twake-mui'
import {
  useCallback,
  useMemo,
  useState,
  type DragEvent,
  type ReactElement
} from 'react'

import { setDragLabel } from '@/ds/DropTarget/DropTarget'
import type { RowMenuAnchor } from '@/ds/VirtualizedListTable/VirtualizedListTable'
import {
  EmailActionsMenu,
  type EmailActionsMenuAnchor
} from '@common/features/emailActions/EmailActionsMenu'
import { fetchMailboxEmails } from '@common/features/emailActions/mailboxEmails'
import type { TargetEmail } from '@common/features/emailActions/planEmailChanges'
import { useRunEmailAction } from '@common/features/emailActions/useRunEmailAction'
import {
  deletesForever,
  useRemoveEmails
} from '@common/features/emailActions/useRemoveEmails'
import type { MailboxSummary } from '@common/features/mailbox/queries'
import { EmptyFolderBanner } from '@common/features/mailboxActions/EmptyFolderBanner'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { isEmailRow } from './EmailCell'
import { EmailListToolbar } from './EmailListToolbar'
import type { EmailListItemData } from './queries'
import type { EmailSelection } from './useEmailSelection'

/** Type of the emails dragged from a list, read by the folder tree */
export const DRAGGED_EMAILS_TYPE = 'application/x-twake-mail-emails'

/** What a drag from the list carries */
export interface DraggedEmails {
  /** The folder they are dragged from, null from search results */
  mailboxId: string | null
  emailIds: string[]
}

export function readDraggedEmails(
  dataTransfer: DataTransfer
): DraggedEmails | null {
  try {
    const value: unknown = JSON.parse(dataTransfer.getData(DRAGGED_EMAILS_TYPE))
    if (
      typeof value === 'object' &&
      value !== null &&
      'emailIds' in value &&
      Array.isArray(value.emailIds) &&
      'mailboxId' in value
    ) {
      return {
        mailboxId: typeof value.mailboxId === 'string' ? value.mailboxId : null,
        emailIds: value.emailIds.filter(id => typeof id === 'string')
      }
    }
  } catch {
    // Not ours
  }
  return null
}

export interface EmailListActions {
  /** The selection toolbar, the Trash / Spam banner, the actions menu */
  toolbar: ReactElement | null
  banner: ReactElement | null
  menu: ReactElement
  deletesForever: boolean
  onRemove: (email: EmailListItemData) => void
  /** Asks for a folder, then moves the row (or the selection it is in) */
  onMove: (email: EmailListItemData) => void
  onOpenMenu: (email: EmailListItemData, element: HTMLElement) => void
  onRowMenu: (row: VirtualizedTableRow, anchor: RowMenuAnchor) => void
  onRowDragStart: (
    row: VirtualizedTableRow,
    event: DragEvent<HTMLElement>
  ) => void
}

/**
 * The actions of an email list: the selection and its toolbar, the menu of
 * a row (⋮ button, right click, menu key), removing a row, dragging rows
 * to a folder, and emptying the Trash or Spam. A row acted on while
 * selected acts on the whole selection.
 */
export function useEmailListActions({
  emails,
  selection,
  mailbox,
  mailboxId,
  total,
  expandTargets = rows => [...rows],
  onFocusList
}: {
  emails: readonly EmailListItemData[]
  selection: EmailSelection
  /** The folder shown, null for search results */
  mailbox: MailboxSummary | null
  mailboxId: string | null
  total: number | null
  /** The emails rows act on: all the emails of a conversation */
  expandTargets?: (rows: readonly EmailListItemData[]) => TargetEmail[]
  /** Gives the focus back to the list once the selection went */
  onFocusList: () => void
}): EmailListActions {
  const { t } = useI18n()
  const client = useJmapClient()
  const { accountId, extraCapabilities } = useJmapSession()
  const removeEmails = useRemoveEmails()
  const runEmailAction = useRunEmailAction()
  const [menu, setMenu] = useState<{
    anchor: EmailActionsMenuAnchor
    emails: readonly TargetEmail[]
    /** The row alone (a conversation too): what answers go to */
    answerEmailId: string | null
  } | null>(null)

  /** The row alone, or the selection when the row is in it */
  const targetsOf = useCallback(
    (email: EmailListItemData): TargetEmail[] =>
      expandTargets(
        selection.isSelected(email.id) && selection.selected.length > 0
          ? selection.selected
          : [email]
      ),
    [selection, expandTargets]
  )

  /** The row answered from its menu, unless the menu acts on a selection */
  const answerOf = useCallback(
    (email: EmailListItemData): string | null =>
      selection.isSelected(email.id) && selection.selected.length > 1
        ? null
        : email.id,
    [selection]
  )

  const selectedTargets = useMemo(
    () => expandTargets(selection.selected),
    [expandTargets, selection.selected]
  )

  const resolveTargets = useCallback(async (): Promise<
    readonly TargetEmail[]
  > => {
    if (!selection.isAllInFolder || mailboxId === null) {
      return selectedTargets
    }
    return fetchMailboxEmails(client, accountId, mailboxId, {
      extraCapabilities
    })
  }, [
    selection.isAllInFolder,
    selectedTargets,
    mailboxId,
    client,
    accountId,
    extraCapabilities
  ])

  const handleDone = useCallback((): void => {
    selection.clear()
    onFocusList()
  }, [selection, onFocusList])

  const onRemove = useCallback(
    (email: EmailListItemData): void => {
      const targets = targetsOf(email)
      void removeEmails(targets, mailboxId).then(done => {
        if (done && targets.length > 1) handleDone()
      })
    },
    [targetsOf, removeEmails, mailboxId, handleDone]
  )

  const onMove = useCallback(
    (email: EmailListItemData): void => {
      const targets = targetsOf(email)
      void runEmailAction('move', targets, mailboxId).then(done => {
        if (done && targets.length > 1) handleDone()
      })
    },
    [targetsOf, runEmailAction, mailboxId, handleDone]
  )

  const onOpenMenu = useCallback(
    (email: EmailListItemData, element: HTMLElement): void => {
      setMenu({
        anchor: { element },
        emails: targetsOf(email),
        answerEmailId: answerOf(email)
      })
    },
    [targetsOf, answerOf]
  )

  const onRowMenu = useCallback(
    (row: VirtualizedTableRow, anchor: RowMenuAnchor): void => {
      if (isEmailRow(row)) {
        setMenu({
          anchor,
          emails: targetsOf(row),
          answerEmailId: answerOf(row)
        })
      }
    },
    [targetsOf, answerOf]
  )

  const onRowDragStart = useCallback(
    (row: VirtualizedTableRow, event: DragEvent<HTMLElement>): void => {
      if (!isEmailRow(row)) return
      const emailIds = targetsOf(row).map(email => email.id)
      const dragged: DraggedEmails = { mailboxId, emailIds }
      event.dataTransfer.setData(DRAGGED_EMAILS_TYPE, JSON.stringify(dragged))
      event.dataTransfer.effectAllowed = 'move'
      setDragLabel(
        event,
        t('emailActions.drag', { smart_count: emailIds.length })
      )
    },
    [targetsOf, mailboxId, t]
  )

  const handleCloseMenu = useCallback((): void => {
    setMenu(null)
  }, [])

  const handleMenuAction = useCallback((): void => {
    if (menu !== null && menu.emails.length > 1) handleDone()
  }, [menu, handleDone])

  const hasSelection = selection.isAllInFolder || selection.selected.length > 0
  return {
    toolbar: hasSelection ? (
      <EmailListToolbar
        selection={selection}
        targets={selectedTargets}
        loadedCount={emails.length}
        total={total}
        mailbox={mailbox}
        resolveTargets={resolveTargets}
        onDone={handleDone}
      />
    ) : null,
    banner:
      mailbox === null || hasSelection ? null : (
        <EmptyFolderBanner mailbox={mailbox} />
      ),
    menu: (
      <EmailActionsMenu
        anchor={menu?.anchor ?? null}
        onClose={handleCloseMenu}
        emails={menu?.emails ?? []}
        answerEmailId={menu?.answerEmailId ?? null}
        mailboxId={mailboxId}
        onAction={handleMenuAction}
        data-testid="email-context-menu"
      />
    ),
    deletesForever: deletesForever(mailbox),
    onRemove,
    onMove,
    onOpenMenu,
    onRowMenu,
    onRowDragStart
  }
}
