/** How long the focus is watched once an action has removed something */
const WATCH_MS = 1000

const FOCUSABLE = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]'
].join(', ')

/** On the body, or on an element that has left the page */
function isFocusLost(): boolean {
  const active = document.activeElement
  return active === null || active === document.body || !active.isConnected
}

/** The element itself when it takes the focus, else the first one inside */
function firstFocusable(element: Element): HTMLElement | null {
  if (element instanceof HTMLElement && element.matches(FOCUSABLE)) {
    return element
  }
  return element.querySelector<HTMLElement>(FOCUSABLE)
}

/** Focuses the first candidate still in the page that takes the focus */
function focusFirst(candidates: readonly (Element | null)[]): void {
  candidates.some(candidate => {
    const target =
      candidate?.isConnected === true ? firstFocusable(candidate) : null
    target?.focus()
    return target !== null && document.activeElement === target
  })
}

/**
 * Where the focus can go when the row holding `element` (its `li`) leaves
 * the page: the row after it, the one before, the first control of its
 * list, then of the section or navigation around it. Read before the row
 * goes: the neighbours are found from it.
 */
export function focusTargetsAround(element: Element | null): Element[] {
  const row = element?.closest('li') ?? element
  if (row === null) return []
  return [
    row.nextElementSibling,
    row.previousElementSibling,
    row.parentElement,
    row.closest('nav, section')
  ].filter((candidate): candidate is Element => candidate !== null)
}

/**
 * Keeps the keyboard focus in the page after an action removed what held
 * it (deleted a row, closed the menu or dialog it came from): for a while,
 * each time the focus falls back on the body, the first candidate still in
 * the page takes it. A dialog giving the focus back to its opener, which
 * the action removed, loses it after a delay: a single check would miss it.
 */
export function keepFocusInPage(candidates: readonly (Element | null)[]): void {
  const deadline = performance.now() + WATCH_MS
  const check = (): void => {
    if (isFocusLost()) focusFirst(candidates)
    if (performance.now() < deadline) requestAnimationFrame(check)
  }
  check()
}
