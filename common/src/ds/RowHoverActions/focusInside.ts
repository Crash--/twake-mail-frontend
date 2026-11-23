export type FocusInsideHandler = (target: Node) => void

interface Subscription {
  listener: (event: FocusEvent) => void
  handlers: Set<FocusInsideHandler>
}

const subscriptions = new WeakMap<HTMLElement, Subscription>()

function subscribe(parent: HTMLElement): Subscription {
  const handlers = new Set<FocusInsideHandler>()
  const listener = (event: FocusEvent): void => {
    if (!(event.target instanceof Node)) return
    const target = event.target
    handlers.forEach(notify => {
      notify(target)
    })
  }
  parent.addEventListener('focusin', listener)
  const subscription = { listener, handlers }
  subscriptions.set(parent, subscription)
  return subscription
}

/**
 * Calls `handler` with what takes the focus inside `parent`. Every row of a
 * table subscribes to the same parent, which carries one `focusin` listener
 * whatever the number of rows. Returns the unsubscription.
 */
export function onFocusInside(
  parent: HTMLElement,
  handler: FocusInsideHandler
): () => void {
  const subscription = subscriptions.get(parent) ?? subscribe(parent)
  subscription.handlers.add(handler)
  return () => {
    subscription.handlers.delete(handler)
    if (subscription.handlers.size > 0) return
    parent.removeEventListener('focusin', subscription.listener)
    subscriptions.delete(parent)
  }
}
