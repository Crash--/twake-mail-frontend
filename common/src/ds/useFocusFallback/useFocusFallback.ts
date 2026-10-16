import { useCallback, type RefCallback } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(', ')

/** Hides from the focus; a closing dialog leaves it on the page a moment */
const HIDDEN = '[inert], [aria-hidden="true"]'

/** A dialog, such as a confirmation the element opened */
const DIALOG = '[role="dialog"], [role="alertdialog"]'

/** How long a closing dialog may keep the page hidden */
const HIDDEN_PAGE_TIMEOUT_MS = 2000

function isFollowing(node: Node, candidate: Node): boolean {
  const position = node.compareDocumentPosition(candidate)
  return (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

/**
 * The controls that could take the focus instead of `node`, nearest first:
 * those after it, then those before it, in the same dialog (or outside any
 * dialog, as `node`). Listed while `node` is still in the page: once
 * detached, it has no place to compare with. Hidden ones are kept: the
 * page may be hidden only until a dialog has closed.
 */
function focusCandidates(node: HTMLElement): HTMLElement[] {
  const dialog = node.closest(DIALOG)
  const outside = Array.from(
    node.ownerDocument.querySelectorAll<HTMLElement>(FOCUSABLE)
  ).filter(
    candidate =>
      !node.contains(candidate) && candidate.closest(DIALOG) === dialog
  )
  const after = outside.filter(candidate => isFollowing(node, candidate))
  const before = outside
    .filter(candidate => !isFollowing(node, candidate))
    .reverse()
  return [...after, ...before]
}

function isFocusLost(ownerDocument: Document): boolean {
  const active = ownerDocument.activeElement
  return active === null || active === ownerDocument.body
}

function isReachable(candidate: HTMLElement): boolean {
  return (
    candidate.isConnected &&
    candidate.tabIndex >= 0 &&
    candidate.closest(HIDDEN) === null
  )
}

/**
 * Focuses the first candidate still in the page, in the tab order and not
 * hidden, that takes the focus; false when none does
 */
function focusFirst(candidates: HTMLElement[]): boolean {
  return candidates.some(candidate => {
    if (!isReachable(candidate)) return false
    candidate.focus()
    return candidate.ownerDocument.activeElement === candidate
  })
}

/**
 * Gives the lost focus to the first candidate that takes it. Waits while
 * the dialog opened from the element still holds the focus, then while
 * the page is hidden (a closing dialog hides the rest of the page until
 * its exit transition has ended).
 */
function restoreFocus(
  ownerDocument: Document,
  candidates: HTMLElement[],
  dialog: Element | null
): void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  const observer = new MutationObserver(() => {
    if (tryFocus()) stop()
  })
  const stop = (): void => {
    observer.disconnect()
    if (timeout !== null) clearTimeout(timeout)
  }
  const tryFocus = (): boolean => {
    if (dialog?.contains(ownerDocument.activeElement) === true) return false
    if (!isFocusLost(ownerDocument) || focusFirst(candidates)) return true
    timeout ??= setTimeout(stop, HIDDEN_PAGE_TIMEOUT_MS)
    return false
  }
  if (tryFocus()) return
  observer.observe(ownerDocument.documentElement, {
    attributes: true,
    attributeFilter: ['aria-hidden', 'inert'],
    childList: true,
    subtree: true
  })
}

/**
 * A ref giving the focus to the nearest control when its element (a banner,
 * a row) goes away while holding it, instead of leaving it on the page body
 * (RGAA 12.8, WCAG 2.4.3). A control disabled during its action, which
 * drops the focus before the element goes, counts as holding it, as does
 * a dialog it opened (a confirmation) while open, the focus then moving
 * once the dialog has gone. Nothing moves when the focus went elsewhere
 * meanwhile.
 */
export function useFocusFallback<T extends HTMLElement>(): RefCallback<T> {
  return useCallback((node: T | null): (() => void) | undefined => {
    if (node === null) return undefined
    const { ownerDocument } = node
    let hadFocus = node.contains(ownerDocument.activeElement)
    /** The dialog the focus left for */
    let dialog: Element | null = null
    const handleFocusIn = (): void => {
      hadFocus = true
      dialog = null
    }
    const handleFocusOut = (event: FocusEvent): void => {
      const next = event.relatedTarget
      if (!(next instanceof Element) || node.contains(next)) return
      hadFocus = false
      dialog = next.closest(DIALOG)
    }
    node.addEventListener('focusin', handleFocusIn)
    node.addEventListener('focusout', handleFocusOut)
    return () => {
      node.removeEventListener('focusin', handleFocusIn)
      node.removeEventListener('focusout', handleFocusOut)
      const isInDialog = dialog?.contains(ownerDocument.activeElement) === true
      const isHolding =
        node.contains(ownerDocument.activeElement) ||
        (hadFocus && isFocusLost(ownerDocument)) ||
        isInDialog
      if (!isHolding) return
      const candidates = focusCandidates(node)
      const openedDialog = isInDialog ? dialog : null
      // Once the element is gone and the rest of the update rendered
      setTimeout(() => {
        restoreFocus(ownerDocument, candidates, openedDialog)
      }, 0)
    }
  }, [])
}
