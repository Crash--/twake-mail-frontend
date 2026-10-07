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

function isFollowing(node: Node, candidate: Node): boolean {
  const position = node.compareDocumentPosition(candidate)
  return (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

/**
 * The controls that could take the focus instead of `node`, nearest first:
 * those after it, then those before it. Listed while `node` is still in the
 * page: once detached, it has no place to compare with.
 */
function focusCandidates(node: HTMLElement): HTMLElement[] {
  const outside = Array.from(
    node.ownerDocument.querySelectorAll<HTMLElement>(FOCUSABLE)
  ).filter(
    candidate =>
      !node.contains(candidate) &&
      candidate.closest('[inert], [aria-hidden="true"]') === null
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

/** Focuses the first candidate still in the page that takes the focus */
function focusFirst(candidates: HTMLElement[]): void {
  candidates.some(candidate => {
    if (!candidate.isConnected) return false
    candidate.focus()
    return candidate.ownerDocument.activeElement === candidate
  })
}

/**
 * A ref giving the focus to the nearest control when its element (a banner,
 * a row) goes away while holding it, instead of leaving it on the page body
 * (RGAA 12.8, WCAG 2.4.3). A control disabled during its action, which
 * drops the focus before the element goes, counts as holding it. Nothing
 * moves when the focus went elsewhere meanwhile.
 */
export function useFocusFallback<T extends HTMLElement>(): RefCallback<T> {
  return useCallback((node: T | null): (() => void) | undefined => {
    if (node === null) return undefined
    const { ownerDocument } = node
    let hadFocus = node.contains(ownerDocument.activeElement)
    const handleFocusIn = (): void => {
      hadFocus = true
    }
    const handleFocusOut = (event: FocusEvent): void => {
      const next = event.relatedTarget
      if (next instanceof Node && !node.contains(next)) hadFocus = false
    }
    node.addEventListener('focusin', handleFocusIn)
    node.addEventListener('focusout', handleFocusOut)
    return () => {
      node.removeEventListener('focusin', handleFocusIn)
      node.removeEventListener('focusout', handleFocusOut)
      const isHolding =
        node.contains(ownerDocument.activeElement) ||
        (hadFocus && isFocusLost(ownerDocument))
      if (!isHolding) return
      const candidates = focusCandidates(node)
      // Once the element is gone and the rest of the update rendered
      setTimeout(() => {
        if (isFocusLost(ownerDocument)) focusFirst(candidates)
      }, 0)
    }
  }, [])
}
