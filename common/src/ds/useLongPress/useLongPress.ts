// Upstream to twake-ui: yes, as a hook beside the list components. A
// finger held on a row opens its menu, as a right click does with a mouse:
// iOS reports no `contextmenu` for it, Android does (the caller's
// `onContextMenu` then calls `cancel`).
import { useEffect, useRef, type PointerEvent } from 'react'

/** How long a finger stays down before it is a long press, in ms */
export const LONG_PRESS_MS = 500
/** How far it may move meanwhile, in px: further, it scrolls */
const MOVE_TOLERANCE = 10

export interface LongPress {
  /** To spread on the element */
  handlers: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void
    onPointerMove: (event: PointerEvent<HTMLElement>) => void
    onPointerUp: () => void
    onPointerCancel: () => void
  }
  /** Forgets the press under way; true when it already opened the menu */
  cancel: () => boolean
}

function swallowNextClick(): void {
  const swallow = (event: Event): void => {
    event.preventDefault()
    event.stopPropagation()
    stop()
  }
  const stop = (): void => {
    document.removeEventListener('click', swallow, true)
    document.removeEventListener('pointerdown', stop, true)
    document.removeEventListener('keydown', stop, true)
  }
  document.addEventListener('click', swallow, true)
  // No click follows when the finger moved, or on Android after its
  // contextmenu: the next touch or key is another action
  document.addEventListener('pointerdown', stop, true)
  document.addEventListener('keydown', stop, true)
}

/**
 * Calls `onLongPress` with the element when a finger stays on it, and
 * swallows the click that ends that press (no link followed). Without
 * `onLongPress`, the handlers do nothing.
 */
export function useLongPress(
  onLongPress: ((element: HTMLElement) => void) | undefined
): LongPress {
  const timer = useRef<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const hasFired = useRef(false)

  const cancel = (): boolean => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    start.current = null
    const fired = hasFired.current
    hasFired.current = false
    return fired
  }

  useEffect(() => {
    return (): void => {
      cancel()
    }
  }, [])

  return {
    handlers: {
      onPointerDown: event => {
        if (onLongPress === undefined || event.pointerType !== 'touch') return
        cancel()
        const element = event.currentTarget
        start.current = { x: event.clientX, y: event.clientY }
        timer.current = window.setTimeout(() => {
          timer.current = null
          hasFired.current = true
          // The finger lifts on what opened meanwhile (the backdrop of a
          // menu): its click must neither close nor follow anything
          swallowNextClick()
          onLongPress(element)
        }, LONG_PRESS_MS)
      },
      onPointerMove: event => {
        const origin = start.current
        if (origin === null) return
        if (
          Math.hypot(event.clientX - origin.x, event.clientY - origin.y) >
          MOVE_TOLERANCE
        ) {
          cancel()
        }
      },
      onPointerUp: () => {
        cancel()
      },
      onPointerCancel: () => {
        cancel()
      }
    },
    cancel
  }
}
