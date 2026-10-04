import type { Page, Request } from '@playwright/test'

/** The JMAP method calls the app sends, in order */
export interface JmapTraffic {
  /** Names of the methods called since the recording started */
  methods: () => string[]
  /** The same, request by request */
  requests: () => string[][]
  /** Forgets what was recorded so far */
  reset: () => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function methodNames(request: Request): string[] {
  if (request.method() !== 'POST') return []
  if (new URL(request.url()).pathname !== '/jmap') return []
  const body: unknown = request.postDataJSON()
  if (!isRecord(body) || !Array.isArray(body.methodCalls)) return []
  return body.methodCalls.flatMap((call: unknown) =>
    Array.isArray(call) && typeof call[0] === 'string' ? [call[0]] : []
  )
}

/** Records the JMAP method calls of the app (`POST /jmap`) on `page` */
export function recordJmapTraffic(page: Page): JmapTraffic {
  let requests: string[][] = []
  page.on('request', request => {
    const methods = methodNames(request)
    if (methods.length > 0) requests.push(methods)
  })
  return {
    methods: () => requests.flat(),
    requests: () => requests.map(methods => [...methods]),
    reset: () => {
      requests = []
    }
  }
}
