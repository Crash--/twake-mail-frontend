import type {
  Email,
  EmailBodyPart,
  FetchFunction,
  Mailbox
} from 'jmap-client-ts'

/**
 * An in-memory JMAP server answering the requests of the real jmap-client-ts
 * client, through its `fetch` option. Tests mock the network, not the client:
 * what they assert is what the app really sends.
 *
 * Covers what the app uses: the session, `Mailbox/get`, `Mailbox/changes`,
 * `Email/query`, `Email/get` (with `#ids` back-references), `Email/changes`,
 * `Email/set` updates of keywords, and blob downloads. Changes made through
 * `Email/set` or the `addEmail`, `updateEmail`, `destroyEmail` and
 * `updateMailbox` helpers move the states and are reported by `/changes`;
 * direct edits of `emails` and `mailboxes` are not.
 */

export const FAKE_JMAP_ORIGIN = 'https://jmap.example.com'
export const FAKE_SESSION_URL = `${FAKE_JMAP_ORIGIN}/jmap/session`
export const FAKE_API_URL = `${FAKE_JMAP_ORIGIN}/jmap`
export const FAKE_ACCOUNT_ID = 'account-alice'
export const FAKE_USERNAME = 'alice@example.com'

const DOWNLOAD_PREFIX = `${FAKE_JMAP_ORIGIN}/download/`

/** The email properties the fake server stores */
export type FakeEmail = Pick<
  Email,
  | 'id'
  | 'threadId'
  | 'mailboxIds'
  | 'keywords'
  | 'receivedAt'
  | 'subject'
  | 'from'
  | 'to'
  | 'cc'
  | 'preview'
  | 'hasAttachment'
> &
  Partial<Pick<Email, 'htmlBody' | 'attachments' | 'bodyValues' | 'sentAt'>>

export type FakeInvocation = [
  name: string,
  args: Record<string, unknown>,
  callId: string
]

export interface FakeJmapRequest {
  using: string[]
  methodCalls: FakeInvocation[]
}

export interface FakeJmapServer {
  /** To pass as the `fetch` option of `createClient` */
  fetch: FetchFunction
  mailboxes: Mailbox[]
  emails: FakeEmail[]
  /** Blob contents by blob id, served by the download endpoint */
  blobs: Map<string, string>
  /** API requests received, in order */
  requests: FakeJmapRequest[]
  /** Answers every call of these methods with a JMAP error of that type */
  methodErrors: Map<string, string>
  /**
   * Holds the API requests calling `method` (all of them without it) until
   * the returned function is called, to observe the screen while a request
   * is in flight.
   */
  holdRequests: (method?: string) => () => void
  /** Names of the methods called so far, request after request */
  calledMethods: () => string[]
  /** Current states, as a push `StateChange` would carry them */
  states: () => { Email: string; Mailbox: string }
  /** Delivers an email (created) */
  addEmail: (email: FakeEmail) => void
  /** Changes an email (updated): keywords, mailboxes… */
  updateEmail: (id: string, patch: Partial<FakeEmail>) => void
  destroyEmail: (id: string) => void
  /** Changes a mailbox (updated), e.g. its counters */
  updateMailbox: (id: string, patch: Partial<Mailbox>) => void
}

type ChangeKind = 'created' | 'updated' | 'destroyed'

interface ChangeEntry {
  /** State reached by this change */
  state: number
  id: string
  kind: ChangeKind
}

/** What `/changes` reports for an object changed several times */
function mergeKinds(first: ChangeKind, next: ChangeKind): ChangeKind | null {
  if (first === 'created') return next === 'destroyed' ? null : 'created'
  return next === 'destroyed' ? 'destroyed' : first
}

/** States of a data type and its change log, for `/get` and `/changes` */
class ChangeLog {
  #state = 1
  readonly #entries: ChangeEntry[] = []
  readonly #prefix: string
  readonly #maxChanges: number

  constructor(prefix: string, maxChanges: number) {
    this.#prefix = prefix
    this.#maxChanges = maxChanges
  }

  get state(): string {
    return `${this.#prefix}${this.#state}`
  }

  record(id: string, kind: ChangeKind): void {
    this.#state += 1
    this.#entries.push({ state: this.#state, id, kind })
  }

  changes(args: Record<string, unknown>): Record<string, unknown> | null {
    const since =
      typeof args.sinceState === 'string' &&
      args.sinceState.startsWith(this.#prefix)
        ? Number(args.sinceState.slice(this.#prefix.length))
        : Number.NaN
    if (!Number.isInteger(since) || since > this.#state) return null
    const maxChanges = Math.min(
      typeof args.maxChanges === 'number' ? args.maxChanges : Infinity,
      this.#maxChanges
    )
    const kinds = new Map<string, ChangeKind | null>()
    let newState = since
    for (const entry of this.#entries) {
      if (entry.state <= since) continue
      if (!kinds.has(entry.id) && kinds.size >= maxChanges) break
      const previous = kinds.get(entry.id)
      kinds.set(
        entry.id,
        previous === undefined
          ? entry.kind
          : previous === null
            ? entry.kind
            : mergeKinds(previous, entry.kind)
      )
      newState = entry.state
    }
    const idsOf = (kind: ChangeKind): string[] =>
      [...kinds].filter(([, value]) => value === kind).map(([id]) => id)
    return {
      accountId: FAKE_ACCOUNT_ID,
      oldState: `${this.#prefix}${since}`,
      newState: `${this.#prefix}${newState}`,
      hasMoreChanges: newState < this.#state,
      created: idsOf('created'),
      updated: idsOf('updated'),
      destroyed: idsOf('destroyed')
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

export function makeMailbox(
  overrides: Partial<Mailbox> & Pick<Mailbox, 'id' | 'name'>
): Mailbox {
  return {
    parentId: null,
    role: null,
    sortOrder: 0,
    totalEmails: 0,
    unreadEmails: 0,
    totalThreads: 0,
    unreadThreads: 0,
    myRights: {
      mayReadItems: true,
      mayAddItems: true,
      mayRemoveItems: true,
      maySetSeen: true,
      maySetKeywords: true,
      mayCreateChild: true,
      mayRename: true,
      mayDelete: true,
      maySubmit: true
    },
    isSubscribed: true,
    ...overrides
  }
}

export function makeEmail(
  overrides: Partial<FakeEmail> & Pick<FakeEmail, 'id'>
): FakeEmail {
  return {
    threadId: `thread-${overrides.id}`,
    mailboxIds: { 'mailbox-inbox': true },
    keywords: {},
    receivedAt: '2026-10-04T08:30:00Z',
    subject: `Subject ${overrides.id}`,
    from: [{ name: 'Bob Dupont', email: 'bob@example.com' }],
    to: [{ name: 'Alice Martin', email: FAKE_USERNAME }],
    cc: null,
    preview: `Preview of ${overrides.id}`,
    hasAttachment: false,
    htmlBody: [],
    bodyValues: {},
    attachments: [],
    ...overrides
  }
}

export function makeBodyPart(
  overrides: Partial<EmailBodyPart> & Pick<EmailBodyPart, 'type'>
): EmailBodyPart {
  return {
    partId: null,
    blobId: null,
    size: 0,
    headers: [],
    name: null,
    charset: null,
    disposition: null,
    cid: null,
    language: null,
    location: null,
    subParts: null,
    ...overrides
  }
}

/** An email whose body is a single HTML (or text) part */
export function makeEmailWithBody(
  overrides: Partial<FakeEmail> & Pick<FakeEmail, 'id'>,
  body: { html: string } | { text: string }
): FakeEmail {
  const isHtml = 'html' in body
  return makeEmail({
    htmlBody: [
      makeBodyPart({ partId: '1', type: isHtml ? 'text/html' : 'text/plain' })
    ],
    bodyValues: {
      '1': {
        value: isHtml ? body.html : body.text,
        isEncodingProblem: false,
        isTruncated: false
      }
    },
    ...overrides
  })
}

/** The mailboxes James creates for a new account, in no particular order */
export function makeDefaultMailboxes(): Mailbox[] {
  return [
    makeMailbox({ id: 'mailbox-sent', name: 'Sent', role: 'sent' }),
    makeMailbox({
      id: 'mailbox-inbox',
      name: 'INBOX',
      role: 'inbox',
      unreadEmails: 2,
      totalEmails: 3
    }),
    makeMailbox({ id: 'mailbox-trash', name: 'Trash', role: 'trash' }),
    makeMailbox({ id: 'mailbox-drafts', name: 'Drafts', role: 'drafts' }),
    makeMailbox({ id: 'mailbox-spam', name: 'Spam', role: 'junk' })
  ]
}

export const FAKE_WEBSOCKET_URL = 'wss://jmap.example.com/jmap/ws'

function makeSession(webSocket: boolean): Record<string, unknown> {
  return {
    capabilities: {
      ...(webSocket
        ? {
            'urn:ietf:params:jmap:websocket': {
              url: FAKE_WEBSOCKET_URL,
              supportsPush: true
            }
          }
        : {}),
      'urn:ietf:params:jmap:core': {
        maxSizeUpload: 20_000_000,
        maxCallsInRequest: 16,
        maxObjectsInGet: 500,
        maxObjectsInSet: 500
      },
      'urn:ietf:params:jmap:mail': {}
    },
    accounts: {
      [FAKE_ACCOUNT_ID]: {
        name: FAKE_USERNAME,
        isPersonal: true,
        isReadOnly: false,
        accountCapabilities: { 'urn:ietf:params:jmap:mail': {} }
      }
    },
    primaryAccounts: { 'urn:ietf:params:jmap:mail': FAKE_ACCOUNT_ID },
    username: FAKE_USERNAME,
    apiUrl: FAKE_API_URL,
    downloadUrl: `${DOWNLOAD_PREFIX}{accountId}/{blobId}/{name}?type={type}`,
    uploadUrl: `${FAKE_JMAP_ORIGIN}/upload/{accountId}`,
    eventSourceUrl: `${FAKE_JMAP_ORIGIN}/eventSource`,
    state: 'session-1'
  }
}

function pickProperties(
  object: Record<string, unknown>,
  properties: unknown
): Record<string, unknown> {
  if (!Array.isArray(properties)) return { ...object }
  const picked: Record<string, unknown> = { id: object.id }
  for (const property of properties) {
    if (typeof property === 'string')
      picked[property] = object[property] ?? null
  }
  return picked
}

function readPointer(value: unknown, path: string): unknown {
  return path
    .split('/')
    .filter(segment => segment !== '')
    .reduce<unknown>(
      (current, segment) => (isRecord(current) ? current[segment] : undefined),
      value
    )
}

/** Replaces the `#name` back-references of `args` by the values they point at */
function resolveReferences(
  args: Record<string, unknown>,
  responses: FakeInvocation[]
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (!key.startsWith('#') || !isRecord(value)) {
      resolved[key] = value
      continue
    }
    const source = responses.find(([, , callId]) => callId === value.resultOf)
    resolved[key.slice(1)] =
      source && typeof value.path === 'string'
        ? readPointer(source[1], value.path)
        : null
  }
  return resolved
}

/** `invalidResultReference` when a back-reference points at an error */
function referenceError(
  args: Record<string, unknown>,
  responses: FakeInvocation[]
): string | null {
  for (const [key, value] of Object.entries(args)) {
    if (!key.startsWith('#') || !isRecord(value)) continue
    const source = responses.find(([, , callId]) => callId === value.resultOf)
    if (!source || source[0] === 'error') return 'invalidResultReference'
  }
  return null
}

function receivedAtDescending(left: FakeEmail, right: FakeEmail): number {
  return right.receivedAt.localeCompare(left.receivedAt)
}

export function makeFakeJmapServer(
  init: {
    mailboxes?: Mailbox[]
    emails?: FakeEmail[]
    /** Advertises push over WebSocket (without Linagora tickets) */
    webSocket?: boolean
    /** Most objects a `/changes` response reports (`hasMoreChanges` beyond) */
    maxChanges?: number
  } = {}
): FakeJmapServer {
  const server: FakeJmapServer = {
    fetch: handleFetch,
    mailboxes: init.mailboxes ?? makeDefaultMailboxes(),
    emails: init.emails ?? [],
    blobs: new Map(),
    requests: [],
    methodErrors: new Map(),
    holdRequests,
    calledMethods: () =>
      server.requests.flatMap(request =>
        request.methodCalls.map(([name]) => name)
      ),
    states: () => ({ Email: emailLog.state, Mailbox: mailboxLog.state }),
    addEmail: email => {
      server.emails.push(email)
      emailLog.record(email.id, 'created')
    },
    updateEmail: (id, patch) => {
      const email = server.emails.find(candidate => candidate.id === id)
      if (!email) throw new Error(`No email ${id}`)
      Object.assign(email, patch)
      emailLog.record(id, 'updated')
    },
    destroyEmail: id => {
      server.emails = server.emails.filter(email => email.id !== id)
      emailLog.record(id, 'destroyed')
    },
    updateMailbox: (id, patch) => {
      const mailbox = server.mailboxes.find(candidate => candidate.id === id)
      if (!mailbox) throw new Error(`No mailbox ${id}`)
      Object.assign(mailbox, patch)
      mailboxLog.record(id, 'updated')
    }
  }
  const maxChanges = init.maxChanges ?? Infinity
  const emailLog = new ChangeLog('state-email-', maxChanges)
  const mailboxLog = new ChangeLog('state-mailbox-', maxChanges)
  const advertisesWebSocket = init.webSocket ?? false
  let held: { method: string | null; released: Promise<void> } | null = null

  function holdRequests(method?: string): () => void {
    let release = (): void => undefined
    const released = new Promise<void>(resolve => {
      release = () => {
        held = null
        resolve()
      }
    })
    held = { method: method ?? null, released }
    return release
  }

  function isHeld(request: FakeJmapRequest): boolean {
    if (!held) return false
    const { method } = held
    return (
      method === null || request.methodCalls.some(([name]) => name === method)
    )
  }

  function getMailboxes(args: Record<string, unknown>): unknown {
    const ids = Array.isArray(args.ids) ? args.ids : null
    const list = server.mailboxes
      .filter(mailbox => ids === null || ids.includes(mailbox.id))
      .map(mailbox => pickProperties({ ...mailbox }, args.properties))
    const notFound =
      ids?.filter(id => !server.mailboxes.some(mailbox => mailbox.id === id)) ??
      []
    return {
      accountId: FAKE_ACCOUNT_ID,
      state: mailboxLog.state,
      list,
      notFound
    }
  }

  function queryEmails(args: Record<string, unknown>): unknown {
    const filter = isRecord(args.filter) ? args.filter : {}
    const inMailbox =
      typeof filter.inMailbox === 'string' ? filter.inMailbox : null
    const matching = server.emails
      .filter(email => inMailbox === null || inMailbox in email.mailboxIds)
      .sort(receivedAtDescending)
    const position = typeof args.position === 'number' ? args.position : 0
    const limit = typeof args.limit === 'number' ? args.limit : matching.length
    return {
      accountId: FAKE_ACCOUNT_ID,
      queryState: 'q1',
      canCalculateChanges: false,
      position,
      ids: matching.slice(position, position + limit).map(email => email.id),
      total: matching.length
    }
  }

  function getEmails(args: Record<string, unknown>): unknown {
    const ids = Array.isArray(args.ids) ? args.ids : []
    const list = ids.flatMap(id => {
      const email = server.emails.find(candidate => candidate.id === id)
      return email ? [pickProperties({ ...email }, args.properties)] : []
    })
    const notFound = ids.filter(
      id => !server.emails.some(email => email.id === id)
    )
    return { accountId: FAKE_ACCOUNT_ID, state: emailLog.state, list, notFound }
  }

  function setSeen(email: FakeEmail, seen: boolean): void {
    if ('$seen' in email.keywords === seen) return
    for (const mailbox of server.mailboxes) {
      if (mailbox.id in email.mailboxIds) {
        mailbox.unreadEmails += seen ? -1 : 1
        mailboxLog.record(mailbox.id, 'updated')
      }
    }
  }

  function updateEmail(email: FakeEmail, patch: Record<string, unknown>): void {
    for (const [path, value] of Object.entries(patch)) {
      const keyword = path.startsWith('keywords/') ? path.slice(9) : null
      if (keyword === null) continue
      if (keyword === '$seen') setSeen(email, value === true)
      if (value === true) {
        email.keywords = { ...email.keywords, [keyword]: true }
      } else {
        const { [keyword]: _removed, ...rest } = email.keywords
        email.keywords = rest
      }
    }
  }

  function setEmails(args: Record<string, unknown>): unknown {
    const update = isRecord(args.update) ? args.update : {}
    const updated: Record<string, null> = {}
    const notUpdated: Record<string, unknown> = {}
    const oldState = emailLog.state
    for (const [id, patch] of Object.entries(update)) {
      const email = server.emails.find(candidate => candidate.id === id)
      if (!email || !isRecord(patch)) {
        notUpdated[id] = { type: 'notFound' }
        continue
      }
      updateEmail(email, patch)
      emailLog.record(id, 'updated')
      updated[id] = null
    }
    return {
      accountId: FAKE_ACCOUNT_ID,
      oldState,
      newState: emailLog.state,
      updated,
      notUpdated
    }
  }

  function answer(name: string, args: Record<string, unknown>): unknown {
    switch (name) {
      case 'Mailbox/get':
        return getMailboxes(args)
      case 'Email/query':
        return queryEmails(args)
      case 'Email/get':
        return getEmails(args)
      case 'Email/set':
        return setEmails(args)
      case 'Email/changes':
        return emailLog.changes(args) ?? { error: 'cannotCalculateChanges' }
      case 'Mailbox/changes':
        return mailboxLog.changes(args) ?? { error: 'cannotCalculateChanges' }
      default:
        return null
    }
  }

  function parseRequest(body: unknown): FakeJmapRequest {
    const methodCalls: FakeInvocation[] = []
    if (isRecord(body) && Array.isArray(body.methodCalls)) {
      for (const call of body.methodCalls) {
        if (
          Array.isArray(call) &&
          typeof call[0] === 'string' &&
          isRecord(call[1]) &&
          typeof call[2] === 'string'
        ) {
          methodCalls.push([call[0], call[1], call[2]])
        }
      }
    }
    const using =
      isRecord(body) && Array.isArray(body.using)
        ? body.using.filter(item => typeof item === 'string')
        : []
    return { using, methodCalls }
  }

  function respond({ methodCalls }: FakeJmapRequest): Response {
    const methodResponses: FakeInvocation[] = []
    for (const [name, rawArgs, callId] of methodCalls) {
      const errorType =
        server.methodErrors.get(name) ??
        referenceError(rawArgs, methodResponses)
      const result = errorType
        ? null
        : answer(name, resolveReferences(rawArgs, methodResponses))
      const resultError =
        isRecord(result) && typeof result.error === 'string'
          ? result.error
          : null
      methodResponses.push(
        isRecord(result) && resultError === null
          ? [name, result, callId]
          : [
              'error',
              { type: errorType ?? resultError ?? 'unknownMethod' },
              callId
            ]
      )
    }
    return jsonResponse({ methodResponses, sessionState: 'session-1' })
  }

  function handleDownload(url: string): Response {
    const [, blobId = ''] = url.slice(DOWNLOAD_PREFIX.length).split('/')
    const content = server.blobs.get(decodeURIComponent(blobId))
    return content === undefined
      ? new Response('Not found', { status: 404 })
      : new Response(content, { status: 200 })
  }

  async function handleFetch(
    input: string,
    init?: RequestInit
  ): Promise<Response> {
    if (input === FAKE_SESSION_URL) {
      return jsonResponse(makeSession(advertisesWebSocket))
    }
    if (input.startsWith(DOWNLOAD_PREFIX)) return handleDownload(input)
    if (input === FAKE_API_URL && typeof init?.body === 'string') {
      const request = parseRequest(JSON.parse(init.body))
      server.requests.push(request)
      if (held && isHeld(request)) await held.released
      return respond(request)
    }
    return new Response('Not found', { status: 404 })
  }

  return server
}
