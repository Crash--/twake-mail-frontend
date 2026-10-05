import { useLayoutEffect, type RefObject } from 'react'

/** How long the target is kept in place while the messages above load */
const SETTLE_MS = 1500

/** Events meaning the user took the scroll over */
const USER_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const

/**
 * When a conversation opens, scrolls to its target message and moves the
 * focus to its header (`target`), once. The scroll is instant and done
 * before the first paint of the conversation: it opens already on the
 * target. A smooth scroll would run while the view transition of the
 * navigation (list to reading pane) is playing, the two motions fighting,
 * and the re-alignment below would cut it short with a jump. The messages
 * above it load after (bodies, images): until the user scrolls, or
 * `SETTLE_MS` passed, the target is kept in place. A message arriving later
 * never moves anything.
 *
 * Does nothing when `isTarget` is false. `describedById` is the element read with the header the first time it
 * has the focus (subject and count of the conversation, which the focus
 * moving away from the subject would otherwise skip).
 */
export function useRevealOnOpen(
  target: RefObject<HTMLElement | null>,
  isTarget: boolean,
  describedById: string
): void {
  useLayoutEffect(() => {
    const element = target.current
    if (!isTarget || element === null) return undefined

    element.setAttribute('aria-describedby', describedById)
    const clearDescription = (): void => {
      element.removeAttribute('aria-describedby')
    }
    element.addEventListener('blur', clearDescription, { once: true })

    element.focus({ preventScroll: true })
    element.scrollIntoView({ block: 'start', behavior: 'instant' })

    let isSettling = true
    const list = element.closest('ol')
    // The first call reports the size the list has now: ignored unless it
    // changed since the scroll above (the first frame of a view transition
    // waits for its snapshots, the bodies can load and grow before it)
    let lastHeight = list?.getBoundingClientRect().height ?? 0
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            const height = list?.getBoundingClientRect().height ?? 0
            if (height === lastHeight) return
            lastHeight = height
            if (isSettling) {
              element.scrollIntoView({ block: 'start', behavior: 'instant' })
            }
          })
    const timer = window.setTimeout(() => {
      stop()
    }, SETTLE_MS)
    function stop(): void {
      isSettling = false
      observer?.disconnect()
      window.clearTimeout(timer)
      for (const type of USER_EVENTS) {
        document.removeEventListener(type, stop, true)
      }
    }
    if (list) observer?.observe(list)
    for (const type of USER_EVENTS) {
      document.addEventListener(type, stop, true)
    }

    return () => {
      stop()
      element.removeEventListener('blur', clearDescription)
    }
    // Once, when the conversation opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
