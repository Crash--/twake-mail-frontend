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
}

/**
 * The keyboard of the email list. Shortcuts act on the selection, or else
 * on the row holding the focus: `j` / `k` move to the next / previous row,
 * `e` archives, `#` deletes, `s` stars, `u` marks unread; they apply while
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
    const leaves =
      action !== 'markAsUnread' && action !== 'star' && action !== 'unstar'
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
      u: () => {
        runOnTargets('markAsUnread')
      }
    },
    () =>
      openEmailId === null ||
      focusedEmailId() !== null ||
      selection.selected.length > 0
  )

  return { scrollerRef, focusList }
}
