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
 * Covers what the app uses: the session, `Mailbox/get`, `Email/query`,
 * `Email/get` (with `#ids` back-references), `Email/set` updates of keywords,
 * and blob downloads.
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
   * Holds the API requests until the returned function is called, to observe
   * the screen while a request is in flight.
   */
  holdRequests: () => () => void
  /** Names of the methods called so far, request after request */
  calledMethods: () => string[]
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

function makeSession(): Record<string, unknown> {
  return {
    capabilities: {
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

function receivedAtDescending(left: FakeEmail, right: FakeEmail): number {
  return right.receivedAt.localeCompare(left.receivedAt)
}

export function makeFakeJmapServer(
  init: { mailboxes?: Mailbox[]; emails?: FakeEmail[] } = {}
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
      )
  }
  let held: Promise<void> | null = null

  function holdRequests(): () => void {
    let release = (): void => undefined
    held = new Promise(resolve => {
      release = () => {
        held = null
        resolve()
      }
    })
    return release
  }

  function getMailboxes(args: Record<string, unknown>): unknown {
    const ids = Array.isArray(args.ids) ? args.ids : null
    const list = server.mailboxes
      .filter(mailbox => ids === null || ids.includes(mailbox.id))
      .map(mailbox => pickProperties({ ...mailbox }, args.properties))
    return { accountId: FAKE_ACCOUNT_ID, state: 'm1', list, notFound: [] }
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
    return { accountId: FAKE_ACCOUNT_ID, state: 'e1', list, notFound }
  }

  function setSeen(email: FakeEmail, seen: boolean): void {
    if ('$seen' in email.keywords === seen) return
    for (const mailbox of server.mailboxes) {
      if (mailbox.id in email.mailboxIds) {
        mailbox.unreadEmails += seen ? -1 : 1
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
    for (const [id, patch] of Object.entries(update)) {
      const email = server.emails.find(candidate => candidate.id === id)
      if (!email || !isRecord(patch)) {
        notUpdated[id] = { type: 'notFound' }
        continue
      }
      updateEmail(email, patch)
      updated[id] = null
    }
    return {
      accountId: FAKE_ACCOUNT_ID,
      oldState: 'e1',
      newState: 'e2',
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
      const errorType = server.methodErrors.get(name)
      const result = errorType
        ? null
        : answer(name, resolveReferences(rawArgs, methodResponses))
      methodResponses.push(
        isRecord(result)
          ? [name, result, callId]
          : ['error', { type: errorType ?? 'unknownMethod' }, callId]
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
    if (input === FAKE_SESSION_URL) return jsonResponse(makeSession())
    if (input.startsWith(DOWNLOAD_PREFIX)) return handleDownload(input)
    if (input === FAKE_API_URL && typeof init?.body === 'string') {
      const request = parseRequest(JSON.parse(init.body))
      server.requests.push(request)
      if (held) await held
      return respond(request)
    }
    return new Response('Not found', { status: 404 })
  }

  return server
}
