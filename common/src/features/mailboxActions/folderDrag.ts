import {
  findDescendantIds,
  isPersonalMailbox
} from '@common/features/mailbox/mailboxTree'
import type { MailboxSummary } from '@common/features/mailbox/queries'

import { findClashingParentIds } from './folderName'

/** Type of a folder dragged in the tree onto another */
export const DRAGGED_FOLDER_TYPE = 'application/x-twake-mail-folder'

/**
 * The folder being dragged: the data of a drag is unreadable until the drop,
 * yet the folders under the pointer must know whether they take it
 */
let draggedFolderId: string | null = null

export function startFolderDrag(
  dataTransfer: DataTransfer,
  mailboxId: string
): void {
  draggedFolderId = mailboxId
  dataTransfer.setData(DRAGGED_FOLDER_TYPE, mailboxId)
  dataTransfer.effectAllowed = 'move'
}

export function endFolderDrag(): void {
  draggedFolderId = null
}

/** The id of the folder being dragged, null when none is */
export function draggedFolder(): string | null {
  return draggedFolderId
}

/** The id of the dropped folder, null when the drop is no folder */
export function readDraggedFolder(dataTransfer: DataTransfer): string | null {
  const id = dataTransfer.getData(DRAGGED_FOLDER_TYPE)
  return id === '' ? null : id
}

/**
 * A folder that moves, as the "Move folder" of its menu: a personal folder
 * without a role
 */
export function isMovableFolder(mailbox: MailboxSummary): boolean {
  return isPersonalMailbox(mailbox) && mailbox.role === null
}

/**
 * Whether `moved` may go under `target`, as the folder picker of "Move
 * folder" allows: a personal folder that takes subfolders, neither the
 * folder, nor one of its subfolders, nor its parent already, nor a folder
 * holding one of its name (the server refuses it)
 */
export function canMoveFolderUnder(
  mailboxes: readonly MailboxSummary[],
  moved: MailboxSummary,
  target: MailboxSummary
): boolean {
  return (
    isMovableFolder(moved) &&
    isPersonalMailbox(target) &&
    target.myRights.mayCreateChild &&
    target.id !== moved.id &&
    target.id !== moved.parentId &&
    !findDescendantIds(mailboxes, moved.id).includes(target.id) &&
    !findClashingParentIds(mailboxes, moved).includes(target.id)
  )
}
