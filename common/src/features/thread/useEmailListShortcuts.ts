import { useCallback, useEffect, useRef, type RefCallback } from 'react'

import {
  moveRowFocus,
  ROW_FOCUS_ATTRIBUTE
} from '@/ds/VirtualizedListTable/VirtualizedListTable'
import { FLAGGED, hasKeyword } from '@common/features/email/keywords'
import {
  useEmailActions,
  type EmailActionName
} from '@common/features/emailActions/useEmailActions'
import type { TargetEmail } from '@common/features/emailActions/planEmailChanges'
import { useRemoveEmails } from '@common/features/emailActions/useRemoveEmails'
import { useShortcuts } from '@common/features/shortcuts/ShortcutsProvider'

import type { EmailListItemData } from './queries'
import type { EmailSelection } from './useEmailSelection'

/** The row of the list holding the focus, if any */
export function focusedEmailId(): string | null {
  const active = document.activeElement
  return active instanceof Element
    ? (active.closest('tr[data-email-id]')?.getAttribute('data-email-id') ??
        null)
    : null
}

export interface EmailListKeyboard {
  /** To give the scroller of the list (`scrollerRef`) */
  scrollerRef: RefCallback<HTMLElement | Window | null>
  /** Focuses the first row, e.g. once the selection toolbar went */
  focusList: () => void
  /** Shows the first rows: the most recent emails */
  scrollToTop: () => void
  /**
   * While `action` runs on the row of `emailId` and a few frames after,
   * a focus lost (on the page body) once the row left goes to the row that
   * took its place, or the previous one at the end of the list
   */
  keepFocusAfterRow: (emailId: string, action: Promise<boolean>) => void
}

/** The actions keeping the row in the list */
const STAYING_ACTIONS: readonly EmailActionName[] = [
  'markAsRead',
  'markAsUnread',
  'star',
  'unstar'
]

/** Frames the focus is still watched for once the action is done */
const FOCUS_FRAMES = 60

function isFocusLost(): boolean {
  const active = document.activeElement
  return active === null || active === document.body
}

/**
 * The keyboard of the email list. Shortcuts act on the selection, or else
 * on the row holding the focus: `j` / `k` move to the next / previous row,
 * `e` archives, `#` (Delete, Backspace) deletes, `s` stars, `q` marks read,
 * `u` marks unread; they apply while
 * the focus is in the list, or when no email is open beside it. In the
 * list, Ctrl+A (Cmd+A) selects the loaded emails and Escape clears the
 * selection.
 */
export function useEmailListShortcuts(
  emails: readonly EmailListItemData[],
  /** The folder shown, null for search results */
  mailboxId: string | null,
  openEmailId: string | null,
  selection: EmailSelection,
  /** The emails rows act on: all the emails of a conversation */
  expandTargets: (
    rows: readonly EmailListItemData[]
  ) => TargetEmail[] = rows => [...rows]
): EmailListKeyboard {
  const scroller = useRef<HTMLElement | null>(null)
  const { run } = useEmailActions()
  const removeEmails = useRemoveEmails()
  // Read by the key listener of the scroller, attached once
  const selectionRef = useRef(selection)
  useEffect(() => {
    selectionRef.current = selection
  }, [selection])
  // Read by `keepFocusAfterRow`, stable for the memoized rows
  const emailsRef = useRef(emails)
  useEffect(() => {
    emailsRef.current = emails
  }, [emails])

  const handleKeyDown = useCallback((event: KeyboardEvent): void => {
    const current = selectionRef.current
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      current.selectLoaded()
    } else if (
      event.key === 'Escape' &&
      (current.isAllInFolder || current.selected.length > 0)
    ) {
      event.preventDefault()
      current.clear()
    }
  }, [])

  const scrollerRef = useCallback(
    (node: HTMLElement | Window | null): void => {
      scroller.current?.removeEventListener('keydown', handleKeyDown)
      scroller.current = node instanceof HTMLElement ? node : null
      scroller.current?.addEventListener('keydown', handleKeyDown)
    },
    [handleKeyDown]
  )

  const focusList = useCallback((): void => {
    if (scroller.current !== null) moveRowFocus(scroller.current, null, 1)
  }, [])

  const scrollToTop = useCallback((): void => {
    if (scroller.current !== null) scroller.current.scrollTop = 0
  }, [])

  // The row goes away under the focus as soon as the cache drops it, long
  // before the server answers; a dialog (folder picker, confirmation) gives
  // the focus back to its opener once closed, gone by then too
  const keepFocusAfterRow = useCallback(
    (emailId: string, action: Promise<boolean>): void => {
      const list = emailsRef.current
      const index = list.findIndex(email => email.id === emailId)
      const neighbours = [list[index + 1]?.id, list[index - 1]?.id].filter(
        id => id !== undefined
      )
      const rowFocus = (id: string): Element | null =>
        scroller.current?.querySelector(
          `tr[data-email-id="${CSS.escape(id)}"] [${ROW_FOCUS_ATTRIBUTE}]`
        ) ?? null
      let isSettled = false
      let isCancelled = false
      let framesLeft = FOCUS_FRAMES
      const watch = (): void => {
        if (isCancelled) return
        if (rowFocus(emailId) === null && isFocusLost()) {
          const target = neighbours.map(rowFocus).find(found => found !== null)
          if (target instanceof HTMLElement) target.focus()
        }
        if (isSettled) framesLeft -= 1
        if (framesLeft > 0) requestAnimationFrame(watch)
      }
      void action
        .then(done => {
          isSettled = true
          isCancelled = !done
        })
        .catch(() => {
          isCancelled = true
        })
      requestAnimationFrame(watch)
    },
    []
  )

  const focusedEmail = (): EmailListItemData | null => {
    const id = focusedEmailId()
    return emails.find(email => email.id === id) ?? null
  }

  /** The selection, or else the focused row */
  const targets = (): EmailListItemData[] => {
    if (selection.selected.length > 0) return selection.selected
    const email = focusedEmail()
    return email === null ? [] : [email]
  }

  const moveFocus = (direction: 1 | -1): void => {
    if (scroller.current !== null) {
      moveRowFocus(scroller.current, document.activeElement, direction)
    }
  }

  /** The row the focus goes to when the focused one goes away */
  const nextRowId = (emailId: string): string | null => {
    const index = emails.findIndex(email => email.id === emailId)
    return emails[index + 1]?.id ?? emails[index - 1]?.id ?? null
  }

  const focusRow = (emailId: string | null): void => {
    const target =
      emailId === null
        ? null
        : scroller.current?.querySelector(
            `tr[data-email-id="${CSS.escape(emailId)}"] [${ROW_FOCUS_ATTRIBUTE}]`
          )
    if (target instanceof HTMLElement) target.focus()
  }

  const runOnTargets = (action: EmailActionName): void => {
    const chosen = targets()
    const first = chosen[0]
    if (first === undefined) return
    const isSelection = selection.selected.length > 0
    const leaves = !STAYING_ACTIONS.includes(action)
    // The row goes away: the focus moves on to the next one first
    if (leaves && !isSelection) focusRow(nextRowId(first.id))
    void run({ action, emails: expandTargets(chosen), mailboxId }).then(
      done => {
        if (done && isSelection) selection.clear()
      }
    )
  }

  /** After the confirmation, if any: cancelling leaves the focus where it is */
  const removeTargets = async (): Promise<void> => {
    const chosen = targets()
    const first = chosen[0]
    if (first === undefined) return
    const isSelection = selection.selected.length > 0
    const next = isSelection ? null : nextRowId(first.id)
    if (!(await removeEmails(expandTargets(chosen), mailboxId))) return
    if (isSelection) {
      selection.clear()
      focusList()
    } else {
      focusRow(next)
    }
  }

  useShortcuts(
    {
      j: () => {
        moveFocus(1)
      },
      k: () => {
        moveFocus(-1)
      },
      e: () => {
        runOnTargets('archive')
      },
      '#': () => {
        void removeTargets()
      },
      s: () => {
        const chosen = targets()
        if (chosen.length === 0) return
        // A conversation is starred when one of its emails is
        const isStarred = (row: EmailListItemData): boolean =>
          expandTargets([row]).some(email => hasKeyword(email, FLAGGED))
        runOnTargets(chosen.every(isStarred) ? 'unstar' : 'star')
      },
      q: () => {
        runOnTargets('markAsRead')
      },
      u: () => {
        runOnTargets('markAsUnread')
      }
    },
    () =>
      openEmailId === null ||
      focusedEmailId() !== null ||
      selection.selected.length > 0
  )

  return { scrollerRef, focusList, scrollToTop, keepFocusAfterRow }
}
