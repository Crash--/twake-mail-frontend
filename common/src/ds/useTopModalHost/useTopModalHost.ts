// Upstream to twake-ui: yes. MUI's `Modal` hides from assistive
// technologies everything of the page but itself (`aria-hidden` on the
// other children of `<body>`) and keeps the focus inside: a notification of
// the page shown while one is open is neither announced nor reachable. Any
// Twake app showing a toast over a dialog or a drawer needs a place inside.
import { useEffect, useState } from 'react'

const MODAL_ROOT = '.MuiModal-root'
/** A popover (a contact card, a menu): modal, but small and anchored */
const POPOVER_ROOT = '.MuiPopover-root'
const HIDDEN_MODAL = 'MuiModal-hidden'
const MODAL_ELEMENT = '[aria-modal="true"]'
/** The first focus guard of MUI's `FocusTrap`, focusable while it is open */
const FOCUS_TRAP_START = ':scope > [data-testid="sentinelStart"]'

export interface ModalHost {
  /** The `aria-modal` element of the modal, where to draw */
  element: HTMLElement
  /**
   * Still hidden by a modal over it that is closing: what changes inside is
   * not announced until it is done
   */
  isHidden: boolean
}

function isOpenModal(element: Element): boolean {
  return (
    element.matches(MODAL_ROOT) &&
    !element.classList.contains(HIDDEN_MODAL) &&
    element.querySelector(FOCUS_TRAP_START)?.getAttribute('tabindex') !== '-1'
  )
}

/**
 * The `aria-modal` element (a dialog, a modal drawer) of the MUI modal open
 * over the others, a closing one left out, null when there is none: the only
 * part of the page assistive technologies and the keyboard can reach while
 * it is open. A menu (a modal without one) gives null. Without
 * `withPopovers`, the popovers (twake-mui's `ContactCard` is an `aria-modal`
 * one) are left out: no room to draw in there.
 */
export function findTopModalHost(
  page: Document,
  withPopovers = true
): ModalHost | null {
  const top = Array.from(page.body.children)
    .filter(
      element =>
        isOpenModal(element) && (withPopovers || !element.matches(POPOVER_ROOT))
    )
    .at(-1)
  const element = top?.querySelector<HTMLElement>(MODAL_ELEMENT) ?? null
  if (top === undefined || element === null) return null
  return { element, isHidden: top.getAttribute('aria-hidden') === 'true' }
}

function isSameHost(a: ModalHost | null, b: ModalHost | null): boolean {
  return a?.element === b?.element && a?.isHidden === b?.isHidden
}

/**
 * `findTopModalHost`, kept up to date as modals open and close: MUI portals
 * them to `<body>`, marks the ones under another one `aria-hidden`, and
 * turns their focus guards off while they close.
 */
export function useTopModalHost(withPopovers = true): ModalHost | null {
  const [host, setHost] = useState<ModalHost | null>(() =>
    findTopModalHost(document, withPopovers)
  )

  useEffect(() => {
    const page = document
    const observer = new MutationObserver(() => {
      watch()
      const next = findTopModalHost(page, withPopovers)
      setHost(current => (isSameHost(current, next) ? current : next))
    })
    function watch(): void {
      observer.observe(page.body, { childList: true })
      Array.from(page.body.children).forEach(child => {
        observer.observe(child, {
          attributes: true,
          attributeFilter: ['aria-hidden', 'class']
        })
        const focusTrapStart = child.matches(MODAL_ROOT)
          ? child.querySelector(FOCUS_TRAP_START)
          : null
        if (focusTrapStart !== null) {
          observer.observe(focusTrapStart, {
            attributes: true,
            attributeFilter: ['tabindex']
          })
        }
      })
    }
    watch()
    return () => {
      observer.disconnect()
    }
  }, [withPopovers])

  return host
}
