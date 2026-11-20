import type { FetchFunction } from 'jmap-client-ts'

function isGet(init: RequestInit | undefined): boolean {
  return (init?.method ?? 'GET').toUpperCase() === 'GET'
}

/**
 * `fetch` answering the first GET of the session resource with a body
 * already read (the credentials check of the basic sign-in), instead of
 * fetching it again; every other request, and the later reads of the
 * session (`refreshSession`), go to `fetchFunction`.
 */
export function serveSessionOnce(
  fetchFunction: FetchFunction,
  sessionUrl: string,
  sessionBody: string
): FetchFunction {
  let pendingBody: string | null = sessionBody
  return (input, init) => {
    if (pendingBody === null || input !== sessionUrl || !isGet(init)) {
      return fetchFunction(input, init)
    }
    const body = pendingBody
    pendingBody = null
    return Promise.resolve(
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
  }
}
