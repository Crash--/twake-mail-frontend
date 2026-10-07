import type {
  Email,
  EmailBodyPart,
  FetchFunction,
  Identity,
  Mailbox
} from 'jmap-client-ts'

import {
  collapseThreads,
  filterWords,
  markWords,
  matchesFilter,
  sortEmails
} from './fakeEmailQuery'

/**
 * An in-memory JMAP server answering the requests of the real jmap-client-ts
 * client, through its `fetch` option. Tests mock the network, not the client:
 * what they assert is what the app really sends.
 *
 * Covers what the app uses: the session, `Mailbox/get`, `Mailbox/changes`,
 * `Email/query`, `Email/get` (with `#ids` back-references), `Email/changes`,
 * `Email/set` creations (referenced as `#creationId` by the next calls of
 * the request), updates of keywords and mailboxes (path patches, keeping
 * the mailbox counters right) and destructions, `Identity/get`,
 * `EmailSubmission/set` (with `onSuccessUpdateEmail`),
 * `Mailbox/set` (creations,
 * renames, moves, subscriptions, destructions) and `Mailbox/clear`, and
 * blob downloads. Changes made through
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
  Partial<
    Pick<
      Email,
      | 'htmlBody'
      | 'textBody'
      | 'attachments'
      | 'bodyValues'
      | 'sentAt'
      | 'bcc'
      | 'replyTo'
      | 'blobId'
      | 'messageId'
      | 'inReplyTo'
      | 'references'
    >
  > & {
    /**
     * Headers asked as `header:<name>:asText` (identity of a draft…) or
     * `asURLs` (the `<…>` of the value: `List-Post`); a list is a header
     * repeated, read by `asText:all` (`X-TWP-Message`)
     */
    headers?: Record<string, string | string[]>
  }

/** What `Email/set` answers for a created email */
interface FakeEmailCreated {
  id: string
  blobId: string
  threadId: string
  size: number
}

/** A contact of `TMailContact/autocomplete` (Linagora extension) */
export interface FakeContact {
  id: string
  firstname: string
  surname: string
  emailAddress: string
}

/** A mailbox, with the `namespace` of the James shares extension */
export type FakeMailbox = Mailbox & { namespace: string | null }

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
  mailboxes: FakeMailbox[]
  emails: FakeEmail[]
  /** Contacts `TMailContact/autocomplete` answers with */
  contacts: FakeContact[]
  identities: Identity[]
  /** Ids of the emails submitted with `EmailSubmission/set`, in order */
  submitted: string[]
  /** The MDNs sent with `MDN/send` (RFC 9007), in order */
  mdnSent: Record<string, unknown>[]
  /** The Linagora `Settings` of the account (`Settings/get`) */
  settings: Record<string, string>
  /** Blob contents by blob id, served by the download endpoint */
  blobs: Map<string, string>
  /** API requests received, in order */
  requests: FakeJmapRequest[]
  /** Answers every call of these methods with a JMAP error of that type */
  methodErrors: Map<string, string>
  /**
   * Refuses to update or destroy these emails (`notUpdated`, `notDestroyed`
   * with that SetError type)
   */
  setErrors: Map<string, string>
  /**
   * Threads `Thread/get` answers `notFound` though their emails exist, as
   * tmail-backend sometimes does after destroying some of their emails
   */
  lostThreads: Set<string>
  /**
   * Holds the API requests calling `method` (all of them without it) until
   * the returned function is called, to observe the screen while a request
   * is in flight.
   */
  holdRequests: (method?: string) => () => void
  /**
   * Runs the next API request calling `method`, then fails its fetch as a
   * lost connection would: the client never sees the answer
   */
  loseNextResponse: (method: string) => void
  /**
   * Answers the methods the fake does not implement (Linagora extensions…):
   * a handler returns the response arguments, or `{ error: type }`
   */
  handlers: Map<string, (args: Record<string, unknown>) => unknown>
  /** Names of the methods called so far, request after request */
  calledMethods: () => string[]
  /** Arguments of every call of a method, in order */
  callsOf: (method: string) => Record<string, unknown>[]
  /** Current states, as a push `StateChange` would carry them */
  states: () => { Email: string; Mailbox: string }
  /** Delivers an email (created) */
  addEmail: (email: FakeEmail) => void
  /** Changes an email (updated): keywords, mailboxes… */
  updateEmail: (id: string, patch: Partial<FakeEmail>) => void
  destroyEmail: (id: string) => void
  /** Changes a mailbox (updated), e.g. its counters */
  updateMailbox: (id: string, patch: Partial<FakeMailbox>) => void
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
  overrides: Partial<FakeMailbox> & Pick<Mailbox, 'id' | 'name'>
): FakeMailbox {
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
    namespace: 'Personal',
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

export function makeIdentity(
  overrides: Partial<Identity> & Pick<Identity, 'id'>
): Identity {
  return {
    name: 'Alice Martin',
    email: FAKE_USERNAME,
    replyTo: null,
    bcc: null,
    textSignature: '',
    htmlSignature: '',
    mayDelete: false,
    ...overrides
  }
}

/** The mailboxes James creates for a new account, in no particular order */
export function makeDefaultMailboxes(): FakeMailbox[] {
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

/** The namespace James gives the folders of a team mailbox */
export function teamNamespace(address: string): string {
  return `TeamMailbox[${address}]`
}

/** The system folders James creates in a team mailbox, under its root */
const TEAM_FOLDER_NAMES = [
  'INBOX',
  'Drafts',
  'Outbox',
  'Sent',
  'Trash',
  'Templates'
] as const

export interface TeamMailboxOptions {
  /** Id of the root; the folders are `<id>-inbox`, `<id>-drafts`… */
  id?: string
  /** Name of the root, the local part of the address by default */
  name?: string
  address?: string
  /** What the member may do in every folder, all of it by default */
  rights?: Partial<Mailbox['myRights']>
}

/**
 * A team mailbox as James exposes it: a root without parent and its system
 * folders, which have no role, every one in the namespace
 * `TeamMailbox[<address>]`. A member may do everything but rename or delete
 * the folders of the team.
 */
export function makeTeamMailboxes({
  id = 'team',
  address = 'team@example.com',
  name = address.split('@')[0] ?? id,
  rights = {}
}: TeamMailboxOptions = {}): FakeMailbox[] {
  const common = {
    namespace: teamNamespace(address),
    myRights: {
      mayReadItems: true,
      mayAddItems: true,
      mayRemoveItems: true,
      maySetSeen: true,
      maySetKeywords: true,
      mayCreateChild: true,
      mayRename: false,
      mayDelete: false,
      maySubmit: true,
      ...rights
    }
  }
  return [
    makeMailbox({ id, name, ...common }),
    ...TEAM_FOLDER_NAMES.map(folder =>
      makeMailbox({
        id: `${id}-${folder.toLowerCase()}`,
        name: folder,
        parentId: id,
        ...common
      })
    )
  ]
}

export const FAKE_WEBSOCKET_URL = 'wss://jmap.example.com/jmap/ws'

function makeSession(
  webSocket: boolean,
  extraCapabilities: Readonly<Record<string, unknown>>,
  maxObjectsInSet: number
): Record<string, unknown> {
  return {
    capabilities: {
      ...extraCapabilities,
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
        maxObjectsInSet
      },
      'urn:ietf:params:jmap:mail': {}
    },
    accounts: {
      [FAKE_ACCOUNT_ID]: {
        name: FAKE_USERNAME,
        isPersonal: true,
        isReadOnly: false,
        accountCapabilities: {
          ...extraCapabilities,
          'urn:ietf:params:jmap:mail': {}
        }
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

/** Reads a JSON pointer of a result reference, `*` mapping over arrays */
function readPointer(value: unknown, path: string): unknown {
  const read = (current: unknown, segments: readonly string[]): unknown => {
    const [segment, ...rest] = segments
    if (segment === undefined) return current
    if (segment === '*') {
      if (!Array.isArray(current)) return undefined
      const items: unknown[] = current
      return items.flatMap((item): unknown[] => {
        const found = read(item, rest)
        return Array.isArray(found) ? (found as unknown[]) : [found]
      })
    }
    return read(isRecord(current) ? current[segment] : undefined, rest)
  }
  return read(
    value,
    path.split('/').filter(segment => segment !== '')
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

/** Replaces `#creationId` in `ids`, `destroy` and the `emailId` of creations by the ids created */
function resolveCreationIds(
  args: Record<string, unknown>,
  createdIds: ReadonlyMap<string, string>
): Record<string, unknown> {
  const resolve = (value: unknown): unknown =>
    typeof value === 'string' && value.startsWith('#')
      ? (createdIds.get(value.slice(1)) ?? value)
      : value
  const resolved = { ...args }
  for (const key of ['ids', 'destroy']) {
    const list = resolved[key]
    if (Array.isArray(list)) resolved[key] = list.map(resolve)
  }
  // The email of a submission
  if (isRecord(resolved.create)) {
    resolved.create = Object.fromEntries(
      Object.entries(resolved.create).map(([creationId, value]) => [
        creationId,
        isRecord(value) ? { ...value, emailId: resolve(value.emailId) } : value
      ])
    )
  }
  return resolved
}

export function makeFakeJmapServer(
  init: {
    mailboxes?: FakeMailbox[]
    emails?: FakeEmail[]
    /** Advertises push over WebSocket (without Linagora tickets) */
    webSocket?: boolean
    /** Most objects a `/changes` response reports (`hasMoreChanges` beyond) */
    maxChanges?: number
    /** Extra capabilities of the session and the account */
    capabilities?: Record<string, unknown>
    contacts?: FakeContact[]
    identities?: Identity[]
    /** `maxObjectsInSet` of the session, 500 by default */
    maxObjectsInSet?: number
    settings?: Record<string, string>
  } = {}
): FakeJmapServer {
  const server: FakeJmapServer = {
    fetch: handleFetch,
    mailboxes: init.mailboxes ?? makeDefaultMailboxes(),
    emails: init.emails ?? [],
    contacts: init.contacts ?? [],
    identities: init.identities ?? [makeIdentity({ id: 'identity-alice' })],
    submitted: [],
    mdnSent: [],
    settings: init.settings ?? {},
    blobs: new Map(),
    requests: [],
    methodErrors: new Map(),
    setErrors: new Map(),
    lostThreads: new Set(),
    holdRequests,
    loseNextResponse: method => {
      losing = method
    },
    handlers: new Map(),
    callsOf: method =>
      server.requests.flatMap(request =>
        request.methodCalls
          .filter(([name]) => name === method)
          .map(([, args]) => args)
      ),
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
  const extraCapabilities = init.capabilities ?? {}
  const maxObjectsInSet = init.maxObjectsInSet ?? 500
  let held: { method: string | null; released: Promise<void> } | null = null
  let losing: string | null = null

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
    const found = sortEmails(
      server.emails.filter(email => matchesFilter(email, args.filter)),
      args.sort
    )
    const matching =
      args.collapseThreads === true ? collapseThreads(found) : found
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

  function getSnippets(args: Record<string, unknown>): unknown {
    const ids = Array.isArray(args.emailIds) ? args.emailIds : []
    const words = filterWords(args.filter)
    const list = ids.flatMap(id => {
      const email = server.emails.find(candidate => candidate.id === id)
      return email
        ? [
            {
              emailId: email.id,
              subject: markWords(email.subject, words),
              preview: markWords(email.preview, words)
            }
          ]
        : []
    })
    const notFound = ids.filter(
      id => !server.emails.some(email => email.id === id)
    )
    return { accountId: FAKE_ACCOUNT_ID, list, notFound }
  }

  function getThreads(args: Record<string, unknown>): unknown {
    const ids = Array.isArray(args.ids) ? args.ids : []
    const exists = (id: unknown): boolean =>
      !server.lostThreads.has(String(id)) &&
      server.emails.some(email => email.threadId === id)
    const list = ids.flatMap(id => {
      const emails = sortEmails(
        server.emails.filter(email => email.threadId === id),
        [{ property: 'receivedAt', isAscending: true }]
      )
      return exists(id) ? [{ id, emailIds: emails.map(email => email.id) }] : []
    })
    const notFound = ids.filter(id => !exists(id))
    return { accountId: FAKE_ACCOUNT_ID, state: emailLog.state, list, notFound }
  }

  function autocompleteContacts(args: Record<string, unknown>): unknown {
    const text =
      isRecord(args.filter) && typeof args.filter.text === 'string'
        ? args.filter.text.toLowerCase()
        : ''
    const limit = typeof args.limit === 'number' ? args.limit : 10
    const list = server.contacts
      .filter(
        contact =>
          contact.emailAddress.toLowerCase().includes(text) ||
          `${contact.firstname} ${contact.surname}`.toLowerCase().includes(text)
      )
      .slice(0, limit)
    return { accountId: FAKE_ACCOUNT_ID, list }
  }

  function getEmails(args: Record<string, unknown>): unknown {
    const ids = Array.isArray(args.ids) ? args.ids : []
    const list = ids.flatMap(id => {
      const email = server.emails.find(candidate => candidate.id === id)
      if (!email) return []
      const headers = Object.fromEntries(
        Object.entries(email.headers ?? {}).flatMap(([name, header]) => {
          const values = typeof header === 'string' ? [header] : header
          const value = values[0] ?? null
          return [
            [`header:${name}:asText`, value],
            [`header:${name}:asText:all`, values],
            [
              `header:${name}:asURLs`,
              Array.from(
                values.join(' ').matchAll(/<([^>]+)>/g),
                match => match[1]
              )
            ]
          ]
        })
      )
      return [pickProperties({ ...email, ...headers }, args.properties)]
    })
    const notFound = ids.filter(
      id => !server.emails.some(email => email.id === id)
    )
    return { accountId: FAKE_ACCOUNT_ID, state: emailLog.state, list, notFound }
  }

  /**
   * Moves the counters of the mailboxes from `before` (the email as it was,
   * null when created) to `after` (null when destroyed); only the mailboxes
   * whose counters change are reported by `Mailbox/changes`
   */
  function recount(before: FakeEmail | null, after: FakeEmail | null): void {
    const deltas = new Map<string, { total: number; unread: number }>()
    const add = (email: FakeEmail | null, sign: 1 | -1): void => {
      if (email === null) return
      const isUnread = !('$seen' in email.keywords)
      for (const id of Object.keys(email.mailboxIds)) {
        const delta = deltas.get(id) ?? { total: 0, unread: 0 }
        delta.total += sign
        if (isUnread) delta.unread += sign
        deltas.set(id, delta)
      }
    }
    add(before, -1)
    add(after, 1)
    for (const mailbox of server.mailboxes) {
      const delta = deltas.get(mailbox.id)
      if (delta === undefined || (delta.total === 0 && delta.unread === 0)) {
        continue
      }
      mailbox.totalEmails = Math.max(0, mailbox.totalEmails + delta.total)
      mailbox.unreadEmails = Math.max(0, mailbox.unreadEmails + delta.unread)
      mailboxLog.record(mailbox.id, 'updated')
    }
  }

  function setFlag(
    map: Record<string, true>,
    key: string,
    value: unknown
  ): Record<string, true> {
    if (value === true) return { ...map, [key]: true }
    const { [key]: _removed, ...rest } = map
    return rest
  }

  function updateEmail(email: FakeEmail, patch: Record<string, unknown>): void {
    const before = { ...email }
    for (const [path, value] of Object.entries(patch)) {
      if (path.startsWith('keywords/')) {
        email.keywords = setFlag(email.keywords, path.slice(9), value)
      } else if (path.startsWith('mailboxIds/')) {
        email.mailboxIds = setFlag(email.mailboxIds, path.slice(11), value)
      } else if (path === 'mailboxIds' && isRecord(value)) {
        email.mailboxIds = Object.fromEntries(
          Object.keys(value).map(id => [id, true as const])
        )
      }
    }
    recount(before, email)
  }

  let createdEmails = 0

  /** An email made from the arguments of an `Email/set` creation */
  function createEmail(create: Record<string, unknown>): FakeEmailCreated {
    createdEmails += 1
    const id = `email-created-${createdEmails}`
    const flags = (value: unknown): Record<string, true> =>
      isRecord(value)
        ? Object.fromEntries(
            Object.keys(value).map(key => [key, true as const])
          )
        : {}
    const parts = (value: unknown): EmailBodyPart[] =>
      Array.isArray(value)
        ? value.filter(isRecord).map((part, index) =>
            makeBodyPart({
              ...part,
              type: typeof part.type === 'string' ? part.type : 'text/plain',
              blobId:
                typeof part.blobId === 'string' ? `${id}_${index + 3}` : null,
              partId: typeof part.partId === 'string' ? part.partId : null
            })
          )
        : []
    const bodyValues = isRecord(create.bodyValues)
      ? Object.fromEntries(
          Object.entries(create.bodyValues).map(([partId, value]) => [
            partId,
            {
              value: isRecord(value) ? String(value.value) : '',
              isEncodingProblem: false,
              isTruncated: false
            }
          ])
        )
      : {}
    const headers = Object.fromEntries(
      Object.entries(create)
        .filter(([key]) => key.startsWith('header:'))
        .map(([key, value]) => [
          key.replace(/^header:/, '').replace(/:asText$/, ''),
          String(value)
        ])
    )
    const attachments = parts(create.attachments)
    const strings = (value: unknown): string[] | null =>
      Array.isArray(value)
        ? value.filter(item => typeof item === 'string')
        : null
    const addresses = (value: unknown): FakeEmail['to'] =>
      Array.isArray(value) ? (value as FakeEmail['to']) : null
    const email: FakeEmail = makeEmail({
      id,
      mailboxIds: flags(create.mailboxIds),
      keywords: flags(create.keywords),
      receivedAt: new Date().toISOString(),
      subject: typeof create.subject === 'string' ? create.subject : '',
      from: addresses(create.from),
      to: addresses(create.to),
      cc: addresses(create.cc),
      bcc: addresses(create.bcc),
      replyTo: addresses(create.replyTo),
      messageId: [`${id}@example.com`],
      inReplyTo: strings(create.inReplyTo),
      references: strings(create.references),
      preview: '',
      hasAttachment: attachments.some(part => part.disposition !== 'inline'),
      htmlBody: parts(create.htmlBody),
      textBody: parts(create.textBody),
      bodyValues,
      attachments,
      headers
    })
    server.emails.push(email)
    recount(null, email)
    emailLog.record(id, 'created')
    return { id, blobId: `blob-${id}`, threadId: email.threadId, size: 1000 }
  }

  function setEmails(args: Record<string, unknown>): unknown {
    const oldState = emailLog.state
    const create = isRecord(args.create) ? args.create : {}
    const created: Record<string, FakeEmailCreated> = {}
    const notCreated: Record<string, unknown> = {}
    // Creations first, as tmail-backend does
    for (const [creationId, value] of Object.entries(create)) {
      const refusal = server.setErrors.get(creationId)
      if (refusal !== undefined || !isRecord(value)) {
        notCreated[creationId] = { type: refusal ?? 'invalidArguments' }
        continue
      }
      created[creationId] = createEmail(value)
    }
    const update = isRecord(args.update) ? args.update : {}
    const destroy = Array.isArray(args.destroy) ? args.destroy : []
    const updated: Record<string, null> = {}
    const notUpdated: Record<string, unknown> = {}
    const destroyed: string[] = []
    const notDestroyed: Record<string, unknown> = {}
    for (const [id, patch] of Object.entries(update)) {
      const email = server.emails.find(candidate => candidate.id === id)
      const refusal = server.setErrors.get(id)
      if (refusal !== undefined) {
        notUpdated[id] = { type: refusal }
        continue
      }
      if (!email || !isRecord(patch)) {
        notUpdated[id] = { type: 'notFound' }
        continue
      }
      updateEmail(email, patch)
      emailLog.record(id, 'updated')
      updated[id] = null
    }
    for (const id of destroy) {
      if (typeof id !== 'string') continue
      const email = server.emails.find(candidate => candidate.id === id)
      const refusal = server.setErrors.get(id)
      if (refusal !== undefined || !email) {
        notDestroyed[id] = { type: refusal ?? 'notFound' }
        continue
      }
      recount(email, null)
      server.emails = server.emails.filter(candidate => candidate.id !== id)
      emailLog.record(id, 'destroyed')
      destroyed.push(id)
    }
    return {
      accountId: FAKE_ACCOUNT_ID,
      oldState,
      newState: emailLog.state,
      created,
      notCreated,
      updated,
      notUpdated,
      destroyed,
      notDestroyed
    }
  }

  let submissions = 0

  /**
   * Submits created emails (nothing is delivered), then applies
   * `onSuccessUpdateEmail` to the emails of the submissions created;
   * `setErrors` refuses a submission by its creation id
   */
  function setSubmissions(args: Record<string, unknown>): unknown {
    const create = isRecord(args.create) ? args.create : {}
    const created: Record<string, { id: string }> = {}
    const notCreated: Record<string, unknown> = {}
    const emailOf = new Map<string, FakeEmail>()
    for (const [creationId, value] of Object.entries(create)) {
      const email = isRecord(value)
        ? server.emails.find(candidate => candidate.id === value.emailId)
        : undefined
      const refusal = server.setErrors.get(creationId)
      if (refusal !== undefined || !email) {
        notCreated[creationId] = { type: refusal ?? 'invalidArguments' }
        continue
      }
      submissions += 1
      created[creationId] = { id: `submission-${submissions}` }
      emailOf.set(creationId, email)
      server.submitted.push(email.id)
    }
    const onSuccess = isRecord(args.onSuccessUpdateEmail)
      ? args.onSuccessUpdateEmail
      : {}
    for (const [reference, patch] of Object.entries(onSuccess)) {
      const email = emailOf.get(reference.replace(/^#/, ''))
      if (!email || !isRecord(patch)) continue
      updateEmail(email, patch)
      emailLog.record(email.id, 'updated')
    }
    return {
      accountId: FAKE_ACCOUNT_ID,
      newState: 'state-submission-1',
      created,
      notCreated
    }
  }

  /**
   * Sends MDNs (nothing is delivered) for existing emails, then applies
   * `onSuccessUpdateEmail` to the emails they are for
   */
  function sendMdns(args: Record<string, unknown>): unknown {
    const send = isRecord(args.send) ? args.send : {}
    const sent: Record<string, unknown> = {}
    const notSent: Record<string, unknown> = {}
    const emailOf = new Map<string, FakeEmail>()
    for (const [creationId, mdn] of Object.entries(send)) {
      const email = isRecord(mdn)
        ? server.emails.find(candidate => candidate.id === mdn.forEmailId)
        : undefined
      if (!email || !isRecord(mdn)) {
        notSent[creationId] = { type: 'notFound' }
        continue
      }
      server.mdnSent.push(mdn)
      sent[creationId] = { finalRecipient: `rfc822; ${FAKE_USERNAME}` }
      emailOf.set(creationId, email)
    }
    const onSuccess = isRecord(args.onSuccessUpdateEmail)
      ? args.onSuccessUpdateEmail
      : {}
    for (const [reference, patch] of Object.entries(onSuccess)) {
      const email = emailOf.get(reference.replace(/^#/, ''))
      if (!email || !isRecord(patch)) continue
      updateEmail(email, patch)
      emailLog.record(email.id, 'updated')
    }
    return { accountId: FAKE_ACCOUNT_ID, sent, notSent }
  }

  function getIdentities(args: Record<string, unknown>): unknown {
    const list = server.identities
      .filter(
        identity => !Array.isArray(args.ids) || args.ids.includes(identity.id)
      )
      .map(identity => pickProperties({ ...identity }, args.properties))
    return {
      accountId: FAKE_ACCOUNT_ID,
      state: `state-identity-${identityState}`,
      list
    }
  }

  let identityState = 1
  let createdIdentities = 0

  /** `Identity/set`: creations, top-level patches and destructions */
  function setIdentities(args: Record<string, unknown>): unknown {
    const create = isRecord(args.create) ? args.create : {}
    const update = isRecord(args.update) ? args.update : {}
    const destroy = Array.isArray(args.destroy) ? args.destroy : []
    const oldState = `state-identity-${identityState}`
    const created: Record<string, unknown> = {}
    const notCreated: Record<string, unknown> = {}
    const updated: Record<string, null> = {}
    const notUpdated: Record<string, unknown> = {}
    const destroyed: string[] = []
    const notDestroyed: Record<string, unknown> = {}
    for (const [creationId, value] of Object.entries(create)) {
      const refused = server.setErrors.get(creationId)
      if (refused !== undefined || !isRecord(value)) {
        notCreated[creationId] = { type: refused ?? 'invalidArguments' }
        continue
      }
      createdIdentities += 1
      const identity = makeIdentity({
        name: '',
        ...(value as Partial<Identity>),
        id: `identity-created-${createdIdentities}`,
        mayDelete: true
      })
      server.identities.push(identity)
      created[creationId] = { id: identity.id, mayDelete: true }
    }
    for (const [id, patch] of Object.entries(update)) {
      const identity = server.identities.find(candidate => candidate.id === id)
      const refused = server.setErrors.get(id)
      if (refused !== undefined || !identity || !isRecord(patch)) {
        notUpdated[id] = { type: refused ?? 'notFound' }
        continue
      }
      Object.assign(identity, patch)
      updated[id] = null
    }
    for (const id of destroy) {
      const identity = server.identities.find(candidate => candidate.id === id)
      const refused =
        typeof id === 'string' ? server.setErrors.get(id) : undefined
      if (typeof id !== 'string') continue
      if (refused !== undefined || !identity?.mayDelete) {
        notDestroyed[id] = { type: refused ?? 'forbidden' }
        continue
      }
      server.identities = server.identities.filter(other => other !== identity)
      destroyed.push(id)
    }
    identityState += 1
    return {
      accountId: FAKE_ACCOUNT_ID,
      oldState,
      newState: `state-identity-${identityState}`,
      created,
      notCreated,
      updated,
      notUpdated,
      destroyed,
      notDestroyed
    }
  }

  let createdMailboxes = 0

  function setMailboxes(args: Record<string, unknown>): unknown {
    const create = isRecord(args.create) ? args.create : {}
    const update = isRecord(args.update) ? args.update : {}
    const destroy = Array.isArray(args.destroy) ? args.destroy : []
    const removeEmails = args.onDestroyRemoveEmails === true
    const oldState = mailboxLog.state
    const created: Record<string, unknown> = {}
    const notCreated: Record<string, unknown> = {}
    const updated: Record<string, null> = {}
    const notUpdated: Record<string, unknown> = {}
    const destroyed: string[] = []
    const notDestroyed: Record<string, unknown> = {}
    const refusal = (id: string): unknown => {
      const type = server.setErrors.get(id)
      return type === undefined ? null : { type }
    }
    for (const [key, value] of Object.entries(create)) {
      if (!isRecord(value) || typeof value.name !== 'string') {
        notCreated[key] = { type: 'invalidProperties' }
        continue
      }
      createdMailboxes += 1
      const id = `mailbox-created-${createdMailboxes}`
      const parentId =
        typeof value.parentId === 'string' ? value.parentId : null
      const parent = server.mailboxes.find(mailbox => mailbox.id === parentId)
      server.mailboxes.push(
        makeMailbox({
          id,
          name: value.name,
          parentId,
          isSubscribed: value.isSubscribed !== false,
          // A folder of a team mailbox is part of it, with its rights
          ...(parent
            ? { namespace: parent.namespace, myRights: { ...parent.myRights } }
            : {})
        })
      )
      mailboxLog.record(id, 'created')
      created[key] = { id }
    }
    for (const [id, patch] of Object.entries(update)) {
      const mailbox = server.mailboxes.find(candidate => candidate.id === id)
      const refused = refusal(id)
      if (refused !== null || !mailbox || !isRecord(patch)) {
        notUpdated[id] = refused ?? { type: 'notFound' }
        continue
      }
      if (typeof patch.name === 'string') mailbox.name = patch.name
      if ('parentId' in patch) {
        mailbox.parentId =
          typeof patch.parentId === 'string' ? patch.parentId : null
      }
      if (typeof patch.isSubscribed === 'boolean') {
        mailbox.isSubscribed = patch.isSubscribed
      }
      mailboxLog.record(id, 'updated')
      updated[id] = null
    }
    for (const id of destroy) {
      if (typeof id !== 'string') continue
      const mailbox = server.mailboxes.find(candidate => candidate.id === id)
      const refused = refusal(id)
      const hasChild = server.mailboxes.some(
        candidate => candidate.parentId === id
      )
      const emails = server.emails.filter(email => id in email.mailboxIds)
      if (refused !== null || !mailbox) {
        notDestroyed[id] = refused ?? { type: 'notFound' }
      } else if (hasChild) {
        notDestroyed[id] = { type: 'mailboxHasChild' }
      } else if (emails.length > 0 && !removeEmails) {
        notDestroyed[id] = { type: 'mailboxHasEmail' }
      } else {
        for (const email of emails) {
          const { [id]: _removed, ...rest } = email.mailboxIds
          if (Object.keys(rest).length === 0) {
            server.emails = server.emails.filter(other => other !== email)
            emailLog.record(email.id, 'destroyed')
          } else {
            email.mailboxIds = rest
            emailLog.record(email.id, 'updated')
          }
        }
        server.mailboxes = server.mailboxes.filter(other => other !== mailbox)
        mailboxLog.record(id, 'destroyed')
        destroyed.push(id)
      }
    }
    return {
      accountId: FAKE_ACCOUNT_ID,
      oldState,
      newState: mailboxLog.state,
      created,
      notCreated,
      updated,
      notUpdated,
      destroyed,
      notDestroyed
    }
  }

  /** `Mailbox/clear` of tmail-backend: destroys every email of a mailbox */
  function clearMailbox(args: Record<string, unknown>): unknown {
    const mailboxId = typeof args.mailboxId === 'string' ? args.mailboxId : ''
    const refused = server.setErrors.get(mailboxId)
    if (refused !== undefined) {
      return { accountId: FAKE_ACCOUNT_ID, notCleared: { type: refused } }
    }
    const emails = server.emails.filter(email => mailboxId in email.mailboxIds)
    for (const email of emails) {
      recount(email, null)
      server.emails = server.emails.filter(other => other !== email)
      emailLog.record(email.id, 'destroyed')
    }
    return {
      accountId: FAKE_ACCOUNT_ID,
      totalDeletedMessagesCount: emails.length
    }
  }

  function answer(name: string, args: Record<string, unknown>): unknown {
    switch (name) {
      case 'Mailbox/get':
        return getMailboxes(args)
      case 'Email/query':
        return queryEmails(args)
      case 'SearchSnippet/get':
        return getSnippets(args)
      case 'Thread/get':
        return getThreads(args)
      case 'TMailContact/autocomplete':
        return autocompleteContacts(args)
      case 'Email/get':
        return getEmails(args)
      case 'Email/set':
        return setEmails(args)
      case 'Identity/get':
        return getIdentities(args)
      case 'Identity/set':
        return setIdentities(args)
      case 'EmailSubmission/set':
        return setSubmissions(args)
      case 'MDN/send':
        return sendMdns(args)
      case 'Settings/get':
        return {
          accountId: FAKE_ACCOUNT_ID,
          state: 'state-settings-1',
          list: [{ id: 'singleton', settings: server.settings }],
          notFound: []
        }
      case 'Email/changes':
        return emailLog.changes(args) ?? { error: 'cannotCalculateChanges' }
      case 'Mailbox/changes':
        return mailboxLog.changes(args) ?? { error: 'cannotCalculateChanges' }
      case 'Mailbox/set':
        return setMailboxes(args)
      case 'Mailbox/clear':
        return clearMailbox(args)
      default:
        return server.handlers.get(name)?.(args) ?? null
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
    /** Ids of the objects created by the request, by creation id */
    const createdIds = new Map<string, string>()
    for (const [name, rawArgs, callId] of methodCalls) {
      const errorType =
        server.methodErrors.get(name) ??
        referenceError(rawArgs, methodResponses)
      const result = errorType
        ? null
        : answer(
            name,
            resolveCreationIds(
              resolveReferences(rawArgs, methodResponses),
              createdIds
            )
          )
      if (isRecord(result) && isRecord(result.created)) {
        for (const [creationId, object] of Object.entries(result.created)) {
          if (isRecord(object) && typeof object.id === 'string') {
            createdIds.set(creationId, object.id)
          }
        }
      }
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
      return jsonResponse(
        makeSession(advertisesWebSocket, extraCapabilities, maxObjectsInSet)
      )
    }
    if (input.startsWith(DOWNLOAD_PREFIX)) return handleDownload(input)
    if (input === FAKE_API_URL && typeof init?.body === 'string') {
      const request = parseRequest(JSON.parse(init.body))
      server.requests.push(request)
      if (held && isHeld(request)) await held.released
      const response = respond(request)
      if (
        losing !== null &&
        request.methodCalls.some(([name]) => name === losing)
      ) {
        losing = null
        throw new TypeError('Failed to fetch')
      }
      return response
    }
    return new Response('Not found', { status: 404 })
  }

  return server
}
