import type { Page, Request } from '@playwright/test'

/** The JMAP method calls the app sends, in order */
export interface JmapTraffic {
  /** Names of the methods called since the recording started */
  methods: () => string[]
  /** The same, request by request */
  requests: () => string[][]
  /** The writes on emails (drafts) since the recording started */
  writes: () => EmailWrites
  /** Forgets what was recorded so far */
  reset: () => void
}

/** What the app asked the server to write on emails */
export interface EmailWrites {
  /** Objects created by `Email/set` */
  created: number
  /** Objects destroyed by `Email/set` */
  destroyed: number
  /** Objects updated by `Email/set` (keywords, mailboxes) */
  updated: number
  /** `Email/import` calls */
  imported: number
  /** Total of the above: what the server stores or deletes */
  total: number
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

function countKeys(value: unknown): number {
  return isRecord(value) ? Object.keys(value).length : 0
}

function emailWrites(requests: Request[]): EmailWrites {
  const writes = { created: 0, destroyed: 0, updated: 0, imported: 0, total: 0 }
  for (const request of requests) {
    if (request.method() !== 'POST') continue
    if (new URL(request.url()).pathname !== '/jmap') continue
    const body: unknown = request.postDataJSON()
    if (!isRecord(body) || !Array.isArray(body.methodCalls)) continue
    for (const call of body.methodCalls as unknown[]) {
      if (!Array.isArray(call)) continue
      const [name, args] = call as [unknown, unknown]
      if (name === 'Email/import') writes.imported += countKeys(isRecord(args) ? args.emails : null)
      if (name !== 'Email/set' || !isRecord(args)) continue
      writes.created += countKeys(args.create)
      writes.updated += countKeys(args.update)
      writes.destroyed += Array.isArray(args.destroy) ? args.destroy.length : 0
    }
  }
  writes.total = writes.created + writes.destroyed + writes.updated + writes.imported
  return writes
}

/** Records the JMAP method calls of the app (`POST /jmap`) on `page` */
export function recordJmapTraffic(page: Page): JmapTraffic {
  let requests: string[][] = []
  let raw: Request[] = []
  page.on('request', request => {
    const methods = methodNames(request)
    if (methods.length > 0) {
      requests.push(methods)
      raw.push(request)
    }
  })
  return {
    methods: () => requests.flat(),
    requests: () => requests.map(methods => [...methods]),
    writes: () => emailWrites(raw),
    reset: () => {
      requests = []
      raw = []
    }
  }
}
