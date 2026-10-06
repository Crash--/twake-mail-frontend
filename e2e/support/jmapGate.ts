import type { Page, Route } from '@playwright/test'

/** A JMAP request the app sent, with the methods it calls */
export interface HeldCall {
  name: string
  args: unknown
}

export interface JmapGate {
  /** Lets the held requests through, and the ones that follow */
  release: () => void
  /** Number of requests held so far */
  heldCount: () => number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The names of the methods a `POST /jmap` body calls */
function methodNames(body: unknown): string[] {
  if (!isRecord(body) || !Array.isArray(body.methodCalls)) return []
  return body.methodCalls.flatMap((call: unknown) =>
    Array.isArray(call) && typeof call[0] === 'string' ? [call[0]] : []
  )
}

/**
 * Holds the JMAP requests of the app that call one of `methods` until
 * `release()`, to look at a loading state for as long as needed: the data
 * is on its way, and nothing in the page moves until it lands. Other
 * requests (the session, the other methods) go through.
 */
export async function holdJmapMethods(
  page: Page,
  methods: readonly string[]
): Promise<JmapGate> {
  let isReleased = false
  let held = 0
  let open: () => void = () => undefined
  const released = new Promise<void>(resolve => {
    open = resolve
  })
  await page.route('**/jmap', async (route: Route) => {
    const request = route.request()
    const names =
      request.method() === 'POST' ? methodNames(request.postDataJSON()) : []
    if (!isReleased && names.some(name => methods.includes(name))) {
      held += 1
      await released
    }
    await route.continue()
  })
  return {
    release: () => {
      isReleased = true
      open()
    },
    heldCount: () => held
  }
}
