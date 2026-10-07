import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router'

import {
  prepareViewTransition,
  type ViewTransitionDirection
} from '@/ds/ViewTransition/viewTransition'
import { FLAGGED, hasKeyword } from '@common/features/email/keywords'
import { useEmailActions } from '@common/features/emailActions/useEmailActions'
import { useRemoveEmails } from '@common/features/emailActions/useRemoveEmails'
import { useShortcuts } from '@common/features/shortcuts/ShortcutsProvider'
import { OPENED_FROM_LIST } from '@common/features/thread/conversationTarget'
import { emailPath } from '@common/features/thread/EmailCell'
import type { EmailListLocationState } from '@common/features/thread/EmailList'
import { focusedEmailId } from '@common/features/thread/useEmailListShortcuts'
import { emailListQueryOptions } from '@common/features/thread/queries'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import type { EmailDetail } from './queries'
import { useReplyOptions } from './useReplyOptions'

interface Neighbors {
  /** The email above in the list (more recent) */
  previousId: string | null
  /** The email below (older) */
  nextId: string | null
}

/** The emails around `emailId` in the list of its folder, if any */
function useNeighbors(mailboxId: string | null, emailId: string): Neighbors {
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const { data } = useInfiniteQuery({
    ...emailListQueryOptions(client, accountId, mailboxId ?? ''),
    enabled: mailboxId !== null
  })
  return useMemo(() => {
    const ids = (data?.pages ?? []).flatMap(page =>
      page.emails.map(email => email.id)
    )
    const index = ids.indexOf(emailId)
    if (index === -1) return { previousId: null, nextId: null }
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
 * The keyboard shortcuts of an open email (`j` / `k` open the next /
 * previous one of its folder, Escape goes back to the list, `e` archives,
 * `#` deletes, `s` stars, `u` marks unread and goes back to the list),
 * unless the focus is in the list
 * beside it. Once the email leaves its folder (archived, deleted, moved
 * here or by another client), or is deleted, the view goes back to the
 * list, on the row that took its place. Returns what the "previous" and
 * "next" buttons of the toolbar do (the same moves as `k` and `j`).
 */
export function useEmailViewShortcuts({
  emailId,
  email,
  mailboxId,
  backPath,
  leavesWhenMoved = true
}: EmailViewShortcutsOptions): EmailViewNavigation {
  const navigate = useNavigate()
  const { run } = useEmailActions()
  const removeEmails = useRemoveEmails()
  const neighbors = useNeighbors(mailboxId, emailId)
  const replies = useReplyOptions(email)
  const lastNeighbors = useRef(neighbors)
  const wasInMailbox = useRef(false)

  useEffect(() => {
    if (neighbors.previousId !== null || neighbors.nextId !== null) {
      lastNeighbors.current = neighbors
    }
  }, [neighbors])

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
    // Without a neighbor known, the list focuses its first row
    const { nextId, previousId } = lastNeighbors.current
    const focusEmailId = nextId ?? previousId ?? emailId
    void navigate(backPath, {
      state: { focusEmailId } satisfies EmailListLocationState,
      viewTransition: prepareViewTransition('backward')
    })
  }, [isInMailbox, email, emailId, backPath, navigate])

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
      j: () => {
        open(neighbors.nextId, 'forward')
      },
      k: () => {
        open(neighbors.previousId, 'backward')
      },
      e: () => {
        if (email) void run({ action: 'archive', emails: [email], mailboxId })
      },
      '#': () => {
        if (email) void removeEmails([email], mailboxId)
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
