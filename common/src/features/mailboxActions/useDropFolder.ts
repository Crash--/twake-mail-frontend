import { useCallback } from 'react'

import type { MailboxSummary } from '@common/features/mailbox/queries'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'

import {
  canMoveFolderUnder,
  draggedFolder,
  DRAGGED_FOLDER_TYPE,
  readDraggedFolder
} from './folderDrag'
import { useFolderActions } from './FolderActionsProvider'

export interface DropFolder {
  /** Whether the folder being dragged may go under this one */
  accepts: (types: readonly string[]) => boolean
  onDrop: (dataTransfer: DataTransfer) => void
}

/**
 * A folder of the tree dragged onto another moves under it, as
 * tmail-flutter: where "Move folder" may put it (`canMoveFolderUnder`).
 * Keyboard users have "Move folder" in the menu of the folder.
 */
export function useDropFolder(target: MailboxSummary): DropFolder {
  const { data: mailboxes } = useMailboxes()
  const { moveUnder } = useFolderActions()

  const findMovable = useCallback(
    (id: string | null): MailboxSummary | null => {
      if (id === null || mailboxes === undefined) return null
      const moved = mailboxes.find(mailbox => mailbox.id === id)
      return moved !== undefined && canMoveFolderUnder(mailboxes, moved, target)
        ? moved
        : null
    },
    [mailboxes, target]
  )

  const accepts = useCallback(
    (types: readonly string[]): boolean =>
      types.includes(DRAGGED_FOLDER_TYPE) &&
      findMovable(draggedFolder()) !== null,
    [findMovable]
  )

  const onDrop = useCallback(
    (dataTransfer: DataTransfer): void => {
      const moved = findMovable(readDraggedFolder(dataTransfer))
      if (moved !== null) moveUnder(moved, target.id)
    },
    [findMovable, moveUnder, target.id]
  )

  return { accepts, onDrop }
}
