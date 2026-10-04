import { useCallback, useRef, type RefCallback } from 'react'

import {
  moveRowFocus,
  ROW_FOCUS_ATTRIBUTE
} from '@/ds/VirtualizedListTable/VirtualizedListTable'
import { FLAGGED, hasKeyword } from '@common/features/email/keywords'
import {
  useEmailActions,
  type EmailActionName
} from '@common/features/emailActions/useEmailActions'
import { useRemoveEmails } from '@common/features/emailActions/useRemoveEmails'
import { useShortcuts } from '@common/features/shortcuts/ShortcutsProvider'

import type { EmailListItemData } from './queries'

/** The row of the list holding the focus, if any */
export function focusedEmailId(): string | null {
  const active = document.activeElement
  return active instanceof Element
    ? (active.closest('tr[data-email-id]')?.getAttribute('data-email-id') ??
        null)
    : null
}

/**
 * The keyboard shortcuts of the email list, on the row holding the focus:
 * `j` / `k` move to the next / previous row, `e` archives, `#` deletes, `s`
 * stars, `u` marks unread. They apply while the focus is in the list, or
 * when no email is open beside it. Returns the ref to give the scroller of
 * the list (`scrollerRef`).
 */
export function useEmailListShortcuts(
  emails: readonly EmailListItemData[],
  /** The folder shown, null for search results */
  mailboxId: string | null,
  openEmailId: string | null
): RefCallback<HTMLElement | Window | null> {
  const scroller = useRef<HTMLElement | null>(null)
  const { run } = useEmailActions()
  const removeEmails = useRemoveEmails()

  const handleScrollerRef = useCallback(
    (node: HTMLElement | Window | null): void => {
      scroller.current = node instanceof HTMLElement ? node : null
    },
    []
  )

  const focusedEmail = (): EmailListItemData | null => {
    const id = focusedEmailId()
    return emails.find(email => email.id === id) ?? null
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

  const runOnFocused = (action: EmailActionName): void => {
    const email = focusedEmail()
    if (email === null) return
    if (action !== 'markAsUnread' && action !== 'star' && action !== 'unstar') {
      // The row goes away: the focus moves on to the next one first
      focusRow(nextRowId(email.id))
    }
    void run({ action, emails: [email], mailboxId })
  }

  /** After the confirmation, if any: cancelling leaves the focus where it is */
  const removeFocused = async (): Promise<void> => {
    const email = focusedEmail()
    if (email === null) return
    const next = nextRowId(email.id)
    if (await removeEmails([email], mailboxId)) focusRow(next)
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
        runOnFocused('archive')
      },
      '#': () => {
        void removeFocused()
      },
      s: () => {
        const email = focusedEmail()
        if (email) runOnFocused(hasKeyword(email, FLAGGED) ? 'unstar' : 'star')
      },
      u: () => {
        runOnFocused('markAsUnread')
      }
    },
    () => openEmailId === null || focusedEmailId() !== null
  )

  return handleScrollerRef
}
