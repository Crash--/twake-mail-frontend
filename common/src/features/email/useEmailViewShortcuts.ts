import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import {
  prepareViewTransition,
  type ViewTransitionDirection
} from '@/ds/ViewTransition/viewTransition'
import { FLAGGED, hasKeyword } from '@common/features/email/keywords'
import { useEmailActions } from '@common/features/emailActions/useEmailActions'
import { useRemoveEmails } from '@common/features/emailActions/useRemoveEmails'
import {
  afterMoveTarget,
  useAfterMovePreference
} from '@common/features/settings/afterMovePreference'
import { useThreadPreference } from '@common/features/settings/threadPreference'
import { useShortcuts } from '@common/features/shortcuts/ShortcutsProvider'
import { useTeamMailboxEmbed } from '@common/features/teamMailboxEmbed/TeamMailboxEmbedContext'
import { OPENED_FROM_LIST } from '@common/features/thread/conversationTarget'
import { emailPath } from '@common/features/thread/EmailCell'
import type { EmailListLocationState } from '@common/features/thread/EmailList'
import {
  emailListSourceQueryOptions,
  mailboxFilterScope,
  mailboxListSource
} from '@common/features/thread/emailListSource'
import { useListFilter } from '@common/features/thread/ListFilterProvider'
import { focusedEmailId } from '@common/features/thread/useEmailListShortcuts'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import type { EmailDetail } from './queries'
import { useReplyOptions } from './useReplyOptions'
import { runFromView, takeMoveFromView } from './viewMoves'

interface Neighbors {
  /** The email above in the list (more recent) */
  previousId: string | null
  /** The email below (older) */
  nextId: string | null
}

const NO_NEIGHBORS: Neighbors = { previousId: null, nextId: null }

interface KnownNeighbors {
  emailId: string
  neighbors: Neighbors
}

/**
 * The emails around `emailId` in the list of its folder, if any: the list
 * its rows show (conversations, filter), so that both follow one order.
 * Once the email leaves that list (read under the Unread filter, archived…),
 * they stay the ones of the rows shown when it was in it
 */
function useNeighbors(mailboxId: string | null, emailId: string): Neighbors {
  const listed = useListedNeighbors(mailboxId, emailId)
  const [known, setKnown] = useState<KnownNeighbors | null>(null)
  if (
    listed !== null &&
    (known?.emailId !== emailId ||
      known.neighbors.previousId !== listed.previousId ||
      known.neighbors.nextId !== listed.nextId)
  ) {
    setKnown({ emailId, neighbors: listed })
  }
  if (listed !== null) return listed
  return known?.emailId === emailId ? known.neighbors : NO_NEIGHBORS
}

/** The emails around `emailId` in the list, null when it is not listed */
function useListedNeighbors(
  mailboxId: string | null,
  emailId: string
): Neighbors | null {
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const { isEnabled: collapseThreads } = useThreadPreference()
  const { filter } = useListFilter(
    mailboxId === null ? null : mailboxFilterScope(mailboxId)
  )
  const { data } = useInfiniteQuery({
    ...emailListSourceQueryOptions(
      client,
      accountId,
      mailboxListSource(mailboxId ?? '', filter, collapseThreads)
    ),
    enabled: mailboxId !== null
  })
  return useMemo(() => {
    const ids = (data?.pages ?? []).flatMap(page =>
      page.emails.map(email => email.id)
    )
    const index = ids.indexOf(emailId)
    if (index === -1) return null
    return {
      previousId: ids[index - 1] ?? null,
      nextId: ids[index + 1] ?? null
    }
  }, [data, emailId])
}

export interface EmailViewNavigation {
  /** Opens the email above in the folder, null when there is none */
  openPrevious: (() => void) | null
  /** Opens the email below in the folder, null when there is none */
  openNext: (() => void) | null
}

export interface EmailViewShortcuts extends EmailViewNavigation {
  /**
   * Leaves the email gone from its folder: after a move of this view
   * (`isOwnMove`), as the "After deleting or moving an email" preference
   * says, otherwise back to the list
   */
  leaveFolder: (isOwnMove: boolean) => void
}

export interface EmailViewShortcutsOptions {
  emailId: string
  email: EmailDetail | null | undefined
  /** The folder the email is open from, null from search results */
  mailboxId: string | null
  /** The list to go back to */
  backPath: string
  /** Goes back to the list once the email left the folder (by default) */
  leavesWhenMoved?: boolean
}

/**
 * The keyboard shortcuts of an open email (`j` / `k`, → / ←, open the next /
 * previous one of its folder, Escape goes back to the list, `e` archives,
 * `#` (Delete, Backspace) deletes, `s` stars, `q` marks read, `u` marks
 * unread and goes back to the list),
 * unless the focus is in the list
 * beside it. Once the email leaves its folder (archived, deleted, moved
 * by another client), or is deleted, the view goes back to the
 * list, on the row that took its place; moved by this view, it opens the
 * next or previous email instead when the "After deleting or moving an
 * email" preference says so (from a folder, outside the facade of a team
 * mailbox). Returns what the "previous" and
 * "next" buttons of the toolbar do (the same moves as `k` and `j`), and
 * how to leave the folder.
 */
export function useEmailViewShortcuts({
  emailId,
  email,
  mailboxId,
  backPath,
  leavesWhenMoved = true
}: EmailViewShortcutsOptions): EmailViewShortcuts {
  const navigate = useNavigate()
  const { run } = useEmailActions()
  const removeEmails = useRemoveEmails()
  const neighbors = useNeighbors(mailboxId, emailId)
  const replies = useReplyOptions(email)
  const wasInMailbox = useRef(false)
  const afterMove = useAfterMovePreference().preference
  const isTeamFacade = useTeamMailboxEmbed() !== null

  const leaveFolder = useCallback(
    (isOwnMove: boolean): void => {
      const target =
        isOwnMove && mailboxId !== null && !isTeamFacade
          ? afterMoveTarget(afterMove, neighbors)
          : null
      if (target !== null && mailboxId !== null) {
        // As the "Next email" button: the subject of the email takes the focus
        void navigate(emailPath(mailboxId, target.emailId), {
          state: OPENED_FROM_LIST,
          viewTransition: prepareViewTransition(target.direction)
        })
        return
      }
      // Without a neighbor known, the list focuses its first row
      const { nextId, previousId } = neighbors
      const focusEmailId = nextId ?? previousId ?? emailId
      void navigate(backPath, {
        state: { focusEmailId } satisfies EmailListLocationState,
        viewTransition: prepareViewTransition('backward')
      })
    },
    [afterMove, isTeamFacade, mailboxId, neighbors, emailId, backPath, navigate]
  )

  const isInMailbox =
    !leavesWhenMoved ||
    (email !== undefined &&
      email !== null &&
      (mailboxId === null || mailboxId in email.mailboxIds))
  useEffect(() => {
    if (isInMailbox) {
      wasInMailbox.current = true
      return
    }
    if (!wasInMailbox.current || email === undefined) return
    wasInMailbox.current = false
    leaveFolder(takeMoveFromView([emailId]))
  }, [isInMailbox, email, emailId, leaveFolder])

  // The next email comes in like an opened one, the previous one the other way
  const open = (
    id: string | null,
    direction: ViewTransitionDirection
  ): void => {
    if (id !== null && mailboxId !== null) {
      void navigate(emailPath(mailboxId, id), {
        state: OPENED_FROM_LIST,
        viewTransition: prepareViewTransition(direction)
      })
    }
  }

  /** Back to the list, the focus on the row of the email (`focusEmailId`) */
  const backToList = (focusEmailId: string): void => {
    void navigate(backPath, {
      state: { focusEmailId } satisfies EmailListLocationState,
      viewTransition: prepareViewTransition('backward')
    })
  }

  const openNext = (): void => {
    open(neighbors.nextId, 'forward')
  }
  const openPrevious = (): void => {
    open(neighbors.previousId, 'backward')
  }

  useShortcuts(
    {
      Escape: () => {
        backToList(emailId)
      },
      r: () => {
        replies.open('reply')
      },
      R: () => {
        replies.open('replyAll')
      },
      f: () => {
        replies.open('forward')
      },
      j: openNext,
      ArrowRight: openNext,
      k: openPrevious,
      ArrowLeft: openPrevious,
      e: () => {
        if (!email) return
        void runFromView('archive', [email.id], () =>
          run({ action: 'archive', emails: [email], mailboxId })
        )
      },
      '#': () => {
        if (!email) return
        void runFromView('delete-permanently', [email.id], () =>
          removeEmails([email], mailboxId)
        )
      },
      s: () => {
        if (email) {
          void run({
            action: hasKeyword(email, FLAGGED) ? 'unstar' : 'star',
            emails: [email],
            mailboxId
          })
        }
      },
      q: () => {
        if (email)
          void run({ action: 'markAsRead', emails: [email], mailboxId })
      },
      u: () => {
        if (!email) return
        void run({ action: 'markAsUnread', emails: [email], mailboxId })
        // As tmail-flutter: an email left unread is closed
        backToList(email.id)
      }
    },
    () => focusedEmailId() === null
  )

  const { previousId, nextId } = neighbors
  return {
    leaveFolder,
    openPrevious:
      previousId === null || mailboxId === null
        ? null
        : () => {
            open(previousId, 'backward')
          },
    openNext:
      nextId === null || mailboxId === null
        ? null
        : () => {
            open(nextId, 'forward')
          }
  }
}
