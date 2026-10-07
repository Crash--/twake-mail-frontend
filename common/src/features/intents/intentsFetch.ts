import type { IntentsFetch } from 'cozy-interapp'

type FetchFunction = typeof fetch

/** An answer of the stack that is no success: its HTTP status, if any */
export class CozyStackError extends Error {
  readonly status: number | null

  constructor(status: number | null) {
    super(
      status === null
        ? 'The cozy-stack cannot be reached'
        : `The cozy-stack answered ${status}`
    )
    this.name = 'CozyStackError'
    this.status = status
  }
}

/**
 * The `fetch` cozy-interapp calls the stack with (`GET /intents/:id`), with
 * the token of the stack. It rejects on a failure, as cozy-interapp
 * expects: a `CozyStackError` with the status.
 */
export function makeIntentsFetch(
  cozyStackUrl: string,
  accessToken: string,
  fetchFunction: FetchFunction = fetch
): IntentsFetch {
  return async (method, path, body) => {
    let response: Response
    try {
      response = await fetchFunction(
        `${cozyStackUrl}/${path.replace(/^\/+/, '')}`,
        {
          method,
          headers: {
            Accept: 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
            Authorization: `Bearer ${accessToken}`
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          credentials: 'omit'
        }
      )
    } catch {
      throw new CozyStackError(null)
    }
    if (!response.ok) throw new CozyStackError(response.status)
    const json: unknown = await response.json()
    return json
  }
}
