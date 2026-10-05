import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { env } from './env'

/**
 * Hand written JMAP client (RFC 8620 / 8621) used to provision and inspect test data
 * without going through the UI. Deliberately tiny and dependency free: it must not move
 * when the app's own JMAP layer is rewritten.
 */

const CORE = 'urn:ietf:params:jmap:core'
const MAIL = 'urn:ietf:params:jmap:mail'
const SUBMISSION = 'urn:ietf:params:jmap:submission'
/** James extension: exposes shared and team mailboxes, with their `namespace` */
const QUOTA = 'urn:ietf:params:jmap:quota'
const SHARES = 'urn:apache:james:params:jmap:mail:shares'
const DEFAULT_USING: readonly string[] = [CORE, MAIL, SUBMISSION, SHARES]
const LABELS = 'com:linagora:params:jmap:labels'
const IDENTITY_SORT_ORDER =
  'urn:apache:james:params:jmap:mail:identity:sortorder'

export const EML_FIXTURES_DIR: string = path.resolve(
  __dirname,
  '..',
  'fixtures',
  'eml'
)

export type MailboxRole =
  | 'inbox'
  | 'drafts'
  | 'sent'
  | 'trash'
  | 'junk'
  | 'archive'
  | 'templates'
  | 'outbox'

export type JmapAuth =
  | { type: 'basic'; username: string; password: string }
  | { type: 'bearer'; token: string }

export type JmapInvocation = [
  name: string,
  args: Record<string, unknown>,
  callId: string
]

export type Keywords = Record<string, boolean>

export interface JmapSession {
  username: string
  apiUrl: string
  uploadUrl: string
  downloadUrl: string
  eventSourceUrl: string
  primaryAccounts: Record<string, string>
  capabilities: Record<string, unknown>
}

export interface Mailbox {
  id: string
  name: string
  parentId: string | null
  role: string | null
  /** `Personal`, or `TeamMailbox[team@example.com]` / `Delegated[...]` for shared ones */
  namespace: string | null
  totalEmails: number
  unreadEmails: number
}

export interface EmailAddress {
  name?: string | null
  email: string
}

export interface Email {
  id: string
  threadId: string
  mailboxIds: Record<string, boolean>
  keywords: Keywords
  subject: string | null
  from: EmailAddress[] | null
  to: EmailAddress[] | null
  receivedAt: string
  preview: string
  hasAttachment: boolean
}

/** RFC 9425 quota */
export interface JmapQuota {
  id: string
  /** `count` or `octets` */
  resourceType: string
  used: number
  hardLimit: number
}

export interface UploadedBlob {
  blobId: string
  type: string
  size: number
}

/** A recipient: a bare address or an address with a display name */
export type Recipient = string | EmailAddress

export type AttachmentInput =
  | { name: string; type: string; content: string | Buffer }
  | { path: string; name?: string; type?: string }

export interface SendEmailInput {
  /** Defaults to the authenticated user */
  from?: EmailAddress
  to: Recipient | Recipient[]
  cc?: Recipient[]
  bcc?: Recipient[]
  replyTo?: Recipient[]
  subject: string
  /** Plain text body. When both `text` and `html` are given, the message is multipart/alternative */
  text?: string
  html?: string
  attachments?: AttachmentInput[]
  /** Mailbox the sent copy lands in, `sent` by default (Patrol tests use trash/junk to seed those folders) */
  saveTo?: MailboxRole
}

export interface SentEmail {
  emailId: string
  submissionId: string
}

export interface WaitForEmailInput {
  subject: string
  mailboxRole?: MailboxRole
  /** A folder by id, instead of a role */
  mailboxId?: string
  /**
   * Lists the folder instead of searching the subject: the memory image
   * does not find some subjects ("Email 1 subject Tag 1")
   */
  withoutSearch?: boolean
  /** Milliseconds, 15 s by default */
  timeout?: number
}

export class JmapError extends Error {
  readonly type: string

  constructor(message: string, type: string) {
    super(message)
    this.name = 'JmapError'
    this.type = type
  }
}

const EMAIL_PROPERTIES: readonly string[] = [
  'id',
  'threadId',
  'mailboxIds',
  'keywords',
  'subject',
  'from',
  'to',
  'receivedAt',
  'preview',
  'hasAttachment'
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string') {
    throw new JmapError(
      `Expected a string "${key}" in ${JSON.stringify(record)}`,
      'invalidResponse'
    )
  }
  return value
}

function requireRecord(
  record: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  const value = record[key]
  if (!isRecord(value)) {
    throw new JmapError(
      `Expected an object "${key}" in ${JSON.stringify(record)}`,
      'invalidResponse'
    )
  }
  return value
}

function requireArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    throw new JmapError(
      `Expected an array "${key}" in ${JSON.stringify(record)}`,
      'invalidResponse'
    )
  }
  return value
}

function toSession(value: unknown): JmapSession {
  if (!isRecord(value)) {
    throw new JmapError('JMAP session is not an object', 'invalidResponse')
  }
  return {
    username: requireString(value, 'username'),
    apiUrl: requireString(value, 'apiUrl'),
    uploadUrl: requireString(value, 'uploadUrl'),
    downloadUrl: requireString(value, 'downloadUrl'),
    eventSourceUrl: requireString(value, 'eventSourceUrl'),
    // SAFETY: JMAP session primaryAccounts maps capability URIs to account ids (RFC 8620 §2)
    primaryAccounts: requireRecord(value, 'primaryAccounts') as Record<
      string,
      string
    >,
    capabilities: requireRecord(value, 'capabilities')
  }
}

function toMailbox(value: unknown): Mailbox {
  if (!isRecord(value)) {
    throw new JmapError('Mailbox is not an object', 'invalidResponse')
  }
  return {
    id: requireString(value, 'id'),
    name: requireString(value, 'name'),
    parentId: typeof value.parentId === 'string' ? value.parentId : null,
    role: typeof value.role === 'string' ? value.role : null,
    namespace: typeof value.namespace === 'string' ? value.namespace : null,
    totalEmails: typeof value.totalEmails === 'number' ? value.totalEmails : 0,
    unreadEmails:
      typeof value.unreadEmails === 'number' ? value.unreadEmails : 0
  }
}

function toAddresses(value: unknown): EmailAddress[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  return value.filter(isRecord).map(address => ({
    name: typeof address.name === 'string' ? address.name : null,
    email: requireString(address, 'email')
  }))
}

function toEmail(value: unknown): Email {
  if (!isRecord(value)) {
    throw new JmapError('Email is not an object', 'invalidResponse')
  }
  return {
    id: requireString(value, 'id'),
    threadId: requireString(value, 'threadId'),
    // SAFETY: RFC 8621 §4.1.1, both are Id[Boolean] / String[Boolean] maps
    mailboxIds: requireRecord(value, 'mailboxIds') as Record<string, boolean>,
    keywords: (isRecord(value.keywords) ? value.keywords : {}) as Keywords,
    subject: typeof value.subject === 'string' ? value.subject : null,
    from: toAddresses(value.from),
    to: toAddresses(value.to),
    receivedAt: requireString(value, 'receivedAt'),
    preview: typeof value.preview === 'string' ? value.preview : '',
    hasAttachment: value.hasAttachment === true
  }
}

function toEmailAddress(recipient: Recipient): EmailAddress {
  return typeof recipient === 'string' ? { email: recipient } : recipient
}

function toEmailAddresses(
  recipients: Recipient | Recipient[] | undefined
): EmailAddress[] | undefined {
  if (recipients === undefined) {
    return undefined
  }
  return (Array.isArray(recipients) ? recipients : [recipients]).map(
    toEmailAddress
  )
}

const sleep = (ms: number): Promise<number> =>
  new Promise(resolve => setTimeout(() => resolve(ms), ms))

export interface JmapClientOptions {
  auth: JmapAuth
  /** Base URL of the JMAP server, E2E_JMAP_URL by default */
  baseUrl?: string
}

export class JmapClient {
  readonly #auth: JmapAuth
  readonly #baseUrl: string
  #session: JmapSession | null = null
  #identityId: string | null = null

  constructor(options: JmapClientOptions) {
    this.#auth = options.auth
    this.#baseUrl = (options.baseUrl ?? env.jmapUrl).replace(/\/+$/, '')
  }

  /** Basic auth client for a user: what almost every test needs */
  static forUser(
    user: { email: string; password: string },
    baseUrl?: string
  ): JmapClient {
    return new JmapClient({
      auth: { type: 'basic', username: user.email, password: user.password },
      baseUrl
    })
  }

  get #authorization(): string {
    if (this.#auth.type === 'bearer') {
      return `Bearer ${this.#auth.token}`
    }
    return `Basic ${Buffer.from(`${this.#auth.username}:${this.#auth.password}`).toString('base64')}`
  }

  /**
   * The session advertises the browser facing URLs (E2E_PUBLIC_URL): the provisioning client
   * keeps talking to the server it fetched the session from.
   */
  #rebase(url: string): string {
    return url.replace(/^https?:\/\/[^/]+/, new URL(this.#baseUrl).origin)
  }

  async getSession(): Promise<JmapSession> {
    if (this.#session !== null) {
      return this.#session
    }
    const response = await fetch(`${this.#baseUrl}/jmap/session`, {
      headers: {
        Authorization: this.#authorization,
        Accept: 'application/json'
      }
    })
    if (!response.ok) {
      throw new JmapError(
        `GET /jmap/session failed: ${response.status} ${await response.text()}`,
        'session'
      )
    }
    const session = toSession(await response.json())
    this.#session = session
    return session
  }

  async accountId(): Promise<string> {
    const session = await this.getSession()
    const accountId = session.primaryAccounts[MAIL]
    if (accountId === undefined) {
      throw new JmapError(
        `No primary mail account for ${session.username}`,
        'session'
      )
    }
    return accountId
  }

  /** Sends a raw JMAP request and returns its method responses, failing on any `error` response */
  async request(
    methodCalls: JmapInvocation[],
    using: readonly string[] = DEFAULT_USING
  ): Promise<JmapInvocation[]> {
    const session = await this.getSession()
    const response = await fetch(this.#rebase(session.apiUrl), {
      method: 'POST',
      headers: {
        Authorization: this.#authorization,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ using, methodCalls })
    })
    if (!response.ok) {
      throw new JmapError(
        `JMAP request failed: ${response.status} ${await response.text()}`,
        'request'
      )
    }
    const body: unknown = await response.json()
    if (!isRecord(body)) {
      throw new JmapError('JMAP response is not an object', 'invalidResponse')
    }
    const responses = requireArray(body, 'methodResponses').map(
      (entry): JmapInvocation => {
        if (
          !Array.isArray(entry) ||
          typeof entry[0] !== 'string' ||
          !isRecord(entry[1]) ||
          typeof entry[2] !== 'string'
        ) {
          throw new JmapError(
            `Malformed method response ${JSON.stringify(entry)}`,
            'invalidResponse'
          )
        }
        return [entry[0], entry[1], entry[2]]
      }
    )
    const failure = responses.find(([name]) => name === 'error')
    if (failure !== undefined) {
      throw new JmapError(
        `JMAP method error: ${JSON.stringify(failure[1])}`,
        String(failure[1].type)
      )
    }
    return responses
  }

  async #call(
    name: string,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const accountId = await this.accountId()
    const [first] = await this.request([[name, { accountId, ...args }, 'c0']])
    if (first === undefined) {
      throw new JmapError(`${name}: empty response`, 'invalidResponse')
    }
    return first[1]
  }

  /**
   * Calls one method of the account with more capabilities (Linagora
   * extensions…) and returns its response arguments
   */
  async call(
    name: string,
    args: Record<string, unknown>,
    extraCapabilities: readonly string[] = []
  ): Promise<Record<string, unknown>> {
    const accountId = await this.accountId()
    const [first] = await this.request(
      [[name, { accountId, ...args }, 'c0']],
      [...DEFAULT_USING, ...extraCapabilities]
    )
    if (first === undefined) {
      throw new JmapError(`${name}: empty response`, 'invalidResponse')
    }
    return first[1]
  }

  /** Creates a label (`Label/set`) and returns its id and keyword */
  async createLabel(
    displayName: string,
    color: string | null = null
  ): Promise<{ id: string; keyword: string; displayName: string }> {
    const result = await this.call(
      'Label/set',
      { create: { label: { displayName, color } } },
      [LABELS]
    )
    const created = isRecord(result.created) ? result.created.label : undefined
    if (!isRecord(created)) {
      throw new JmapError(
        `Label/set did not create "${displayName}": ${JSON.stringify(result.notCreated)}`,
        'notCreated'
      )
    }
    const id = requireString(created, 'id')
    const keyword = typeof created.keyword === 'string' ? created.keyword : id
    return { id, keyword, displayName }
  }

  /** The labels of the account */
  async getLabels(): Promise<Record<string, unknown>[]> {
    const result = await this.call('Label/get', { ids: null }, [LABELS])
    return requireArray(result, 'list').filter(isRecord)
  }

  /** The identities of the account, with their `sortOrder` (James) */
  async getIdentities(): Promise<Record<string, unknown>[]> {
    const result = await this.call('Identity/get', { ids: null }, [
      IDENTITY_SORT_ORDER
    ])
    return requireArray(result, 'list').filter(isRecord)
  }

  async getMailboxes(): Promise<Mailbox[]> {
    const result = await this.#call('Mailbox/get', { ids: null })
    return requireArray(result, 'list').map(toMailbox)
  }

  async findMailboxByRole(role: MailboxRole): Promise<Mailbox> {
    const mailbox = (await this.getMailboxes()).find(
      candidate => candidate.role === role
    )
    if (mailbox === undefined) {
      throw new JmapError(`No mailbox with role "${role}"`, 'notFound')
    }
    return mailbox
  }

  /** By name, in the personal namespace unless `namespace` says otherwise (team mailboxes have an INBOX too) */
  async findMailboxByName(
    name: string,
    options: { parentId?: string | null; namespace?: string } = {}
  ): Promise<Mailbox> {
    const namespace = options.namespace ?? 'Personal'
    const mailbox = (await this.getMailboxes()).find(
      candidate =>
        candidate.name === name &&
        candidate.namespace === namespace &&
        (options.parentId === undefined ||
          candidate.parentId === options.parentId)
    )
    if (mailbox === undefined) {
      throw new JmapError(
        `No mailbox named "${name}" in ${namespace}`,
        'notFound'
      )
    }
    return mailbox
  }

  async createMailbox(input: {
    name: string
    parentId?: string | null
  }): Promise<Mailbox> {
    const result = await this.#call('Mailbox/set', {
      create: { new: { name: input.name, parentId: input.parentId ?? null } }
    })
    const created = isRecord(result.created) ? result.created.new : undefined
    if (!isRecord(created)) {
      throw new JmapError(
        `Mailbox/set did not create "${input.name}": ${JSON.stringify(result.notCreated)}`,
        'notCreated'
      )
    }
    return this.findMailboxById(requireString(created, 'id'))
  }

  async findMailboxById(id: string): Promise<Mailbox> {
    const result = await this.#call('Mailbox/get', { ids: [id] })
    const [mailbox] = requireArray(result, 'list')
    if (mailbox === undefined) {
      throw new JmapError(`No mailbox with id ${id}`, 'notFound')
    }
    return toMailbox(mailbox)
  }

  /** Quota/get (RFC 9425): one entry per limited resource (`count`, `octets`) */
  async getQuotas(): Promise<JmapQuota[]> {
    const accountId = await this.accountId()
    const [first] = await this.request(
      [['Quota/get', { accountId, ids: null }, 'q']],
      [CORE, QUOTA]
    )
    return requireArray(first?.[1] ?? {}, 'list')
      .filter(isRecord)
      .map(quota => ({
        id: requireString(quota, 'id'),
        resourceType: requireString(quota, 'resourceType'),
        used: typeof quota.used === 'number' ? quota.used : 0,
        hardLimit: typeof quota.hardLimit === 'number' ? quota.hardLimit : 0
      }))
  }

  async upload(content: string | Buffer, type: string): Promise<UploadedBlob> {
    const session = await this.getSession()
    const accountId = await this.accountId()
    const url = this.#rebase(session.uploadUrl).replace(
      '{accountId}',
      encodeURIComponent(accountId)
    )
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: this.#authorization, 'Content-Type': type },
      body: typeof content === 'string' ? content : new Uint8Array(content)
    })
    if (!response.ok) {
      throw new JmapError(
        `Upload failed: ${response.status} ${await response.text()}`,
        'upload'
      )
    }
    const body: unknown = await response.json()
    if (!isRecord(body)) {
      throw new JmapError('Upload response is not an object', 'invalidResponse')
    }
    return {
      blobId: requireString(body, 'blobId'),
      type: requireString(body, 'type'),
      size: typeof body.size === 'number' ? body.size : 0
    }
  }

  async #identityIdFor(email: string): Promise<string> {
    if (this.#identityId !== null) {
      return this.#identityId
    }
    const result = await this.#call('Identity/get', { ids: null })
    const identities = requireArray(result, 'list').filter(isRecord)
    const identity =
      identities.find(candidate => candidate.email === email) ?? identities[0]
    if (identity === undefined) {
      throw new JmapError(`No identity for ${email}`, 'notFound')
    }
    this.#identityId = requireString(identity, 'id')
    return this.#identityId
  }

  async #uploadAttachment(
    attachment: AttachmentInput
  ): Promise<Record<string, unknown>> {
    if ('path' in attachment) {
      const content = await readFile(attachment.path)
      const type = attachment.type ?? 'application/octet-stream'
      const blob = await this.upload(content, type)
      return {
        blobId: blob.blobId,
        type,
        name: attachment.name ?? path.basename(attachment.path),
        disposition: 'attachment'
      }
    }
    const blob = await this.upload(attachment.content, attachment.type)
    return {
      blobId: blob.blobId,
      type: attachment.type,
      name: attachment.name,
      disposition: 'attachment'
    }
  }

  /**
   * Sends an email as the authenticated user: Email/set (in Drafts) then EmailSubmission/set,
   * which moves the message to `saveTo` (Sent) once submitted.
   */
  async sendEmail(input: SendEmailInput): Promise<SentEmail> {
    if (input.text === undefined && input.html === undefined) {
      throw new JmapError(
        'sendEmail needs a text or an html body',
        'invalidArguments'
      )
    }
    const session = await this.getSession()
    const accountId = await this.accountId()
    const from = input.from ?? { email: session.username }
    const identityId = await this.#identityIdFor(from.email)
    const mailboxes = await this.getMailboxes()
    const drafts = mailboxes.find(mailbox => mailbox.role === 'drafts')
    const saveTo = mailboxes.find(
      mailbox => mailbox.role === (input.saveTo ?? 'sent')
    )
    if (drafts === undefined || saveTo === undefined) {
      throw new JmapError(
        `Missing drafts or ${input.saveTo ?? 'sent'} mailbox`,
        'notFound'
      )
    }
    const attachments = await Promise.all(
      (input.attachments ?? []).map(attachment =>
        this.#uploadAttachment(attachment)
      )
    )

    const bodyValues: Record<string, { value: string }> = {}
    const email: Record<string, unknown> = {
      mailboxIds: { [drafts.id]: true },
      keywords: { $draft: true, $seen: true },
      from: [from],
      to: toEmailAddresses(input.to),
      cc: toEmailAddresses(input.cc),
      bcc: toEmailAddresses(input.bcc),
      replyTo: toEmailAddresses(input.replyTo),
      subject: input.subject,
      bodyValues,
      attachments
    }
    if (input.text !== undefined) {
      bodyValues.text = { value: input.text }
      email.textBody = [{ partId: 'text', type: 'text/plain' }]
    }
    if (input.html !== undefined) {
      bodyValues.html = { value: input.html }
      email.htmlBody = [{ partId: 'html', type: 'text/html' }]
    }

    const responses = await this.request([
      ['Email/set', { accountId, create: { draft: email } }, 'c0'],
      [
        'EmailSubmission/set',
        {
          accountId,
          create: { submission: { emailId: '#draft', identityId } },
          onSuccessUpdateEmail: {
            '#submission': {
              [`mailboxIds/${drafts.id}`]: null,
              [`mailboxIds/${saveTo.id}`]: true,
              'keywords/$draft': null
            }
          }
        },
        'c1'
      ]
    ])
    const emailSet = responses.find(
      ([name, , callId]) => name === 'Email/set' && callId === 'c0'
    )?.[1]
    const submissionSet = responses.find(
      ([name]) => name === 'EmailSubmission/set'
    )?.[1]
    const createdEmail =
      emailSet !== undefined && isRecord(emailSet.created)
        ? emailSet.created.draft
        : undefined
    const createdSubmission =
      submissionSet !== undefined && isRecord(submissionSet.created)
        ? submissionSet.created.submission
        : undefined
    if (!isRecord(createdEmail) || !isRecord(createdSubmission)) {
      throw new JmapError(
        `sendEmail "${input.subject}" failed: ${JSON.stringify(emailSet?.notCreated ?? submissionSet?.notCreated)}`,
        'notCreated'
      )
    }
    return {
      emailId: requireString(createdEmail, 'id'),
      submissionId: requireString(createdSubmission, 'id')
    }
  }

  /**
   * Imports an .eml file into a mailbox (upload + Email/import). A relative path is resolved
   * against e2e/fixtures/eml, e.g. `importEml('reply_email/reply-all.eml')`.
   */
  async importEml(
    emlPath: string,
    mailboxRole: MailboxRole = 'inbox',
    options: {
      keywords?: Keywords
      receivedAt?: string
      /** Text replaced in the message, e.g. its recipient by the test user */
      replace?: Record<string, string>
    } = {}
  ): Promise<Email> {
    const absolute = path.isAbsolute(emlPath)
      ? emlPath
      : path.join(EML_FIXTURES_DIR, emlPath)
    let content = await readFile(absolute)
    if (options.replace !== undefined) {
      let text = content.toString('utf8')
      for (const [from, to] of Object.entries(options.replace)) {
        text = text.replaceAll(from, to)
      }
      content = Buffer.from(text, 'utf8')
    }
    const blob = await this.upload(content, 'message/rfc822')
    const mailbox = await this.findMailboxByRole(mailboxRole)
    const result = await this.#call('Email/import', {
      emails: {
        eml: {
          blobId: blob.blobId,
          mailboxIds: { [mailbox.id]: true },
          keywords: options.keywords ?? {},
          ...(options.receivedAt === undefined
            ? {}
            : { receivedAt: options.receivedAt })
        }
      }
    })
    const created = isRecord(result.created) ? result.created.eml : undefined
    if (!isRecord(created)) {
      throw new JmapError(
        `Email/import of ${emlPath} failed: ${JSON.stringify(result.notCreated)}`,
        'notCreated'
      )
    }
    return this.getEmail(requireString(created, 'id'))
  }

  async getEmails(ids: string[]): Promise<Email[]> {
    const result = await this.#call('Email/get', {
      ids,
      properties: EMAIL_PROPERTIES
    })
    return requireArray(result, 'list').map(toEmail)
  }

  async getEmail(id: string): Promise<Email> {
    const [email] = await this.getEmails([id])
    if (email === undefined) {
      throw new JmapError(`No email with id ${id}`, 'notFound')
    }
    return email
  }

  /** Email/query + Email/get, newest first */
  async queryEmails(
    filter: Record<string, unknown> = {},
    limit = 50
  ): Promise<Email[]> {
    const accountId = await this.accountId()
    const responses = await this.request([
      [
        'Email/query',
        {
          accountId,
          filter,
          sort: [{ property: 'receivedAt', isAscending: false }],
          limit
        },
        'q'
      ],
      [
        'Email/get',
        {
          accountId,
          '#ids': { resultOf: 'q', name: 'Email/query', path: '/ids' },
          properties: EMAIL_PROPERTIES
        },
        'g'
      ]
    ])
    const get = responses.find(([name]) => name === 'Email/get')?.[1]
    return get === undefined ? [] : requireArray(get, 'list').map(toEmail)
  }

  /**
   * Adds (`true`) or removes (`false`) keywords, leaving the others untouched:
   * `setKeywords(id, { $seen: true, $flagged: false })`. Resolves once the server accepted the
   * update; it returns nothing because Email/set returns nothing useful (read back with getEmail).
   */
  async setKeywords(emailId: string, keywords: Keywords): Promise<void> {
    const patch: Record<string, true | null> = {}
    for (const [keyword, enabled] of Object.entries(keywords)) {
      patch[`keywords/${keyword}`] = enabled ? true : null
    }
    const result = await this.#call('Email/set', {
      update: { [emailId]: patch }
    })
    if (
      isRecord(result.notUpdated) &&
      result.notUpdated[emailId] !== undefined
    ) {
      throw new JmapError(
        `setKeywords on ${emailId} failed: ${JSON.stringify(result.notUpdated)}`,
        'notUpdated'
      )
    }
  }

  /**
   * Destroys every email of the account, a page of ids at a time (`Email/query` then
   * `Email/set` destroying its ids by back-reference), and returns how many went. Run when a
   * test ends: the memory backend stops answering `Email/set` updates once it holds about 256
   * messages in all (e2e/README.md, "Known backend quirks"), and deleting a user leaves its
   * messages behind.
   */
  async destroyAllEmails(): Promise<number> {
    const accountId = await this.accountId()
    let destroyed = 0
    for (;;) {
      const responses = await this.request([
        ['Email/query', { accountId, limit: 256 }, 'q'],
        [
          'Email/set',
          {
            accountId,
            '#destroy': { resultOf: 'q', name: 'Email/query', path: '/ids' }
          },
          's'
        ]
      ])
      const set = responses.find(([name]) => name === 'Email/set')?.[1]
      const ids =
        set !== undefined && Array.isArray(set.destroyed) ? set.destroyed : []
      destroyed += ids.length
      if (ids.length === 0) {
        return destroyed
      }
    }
  }

  /** Polls until an email with exactly this subject is in the mailbox (Inbox by default) */
  async waitForEmail(input: WaitForEmailInput): Promise<Email> {
    const timeout = input.timeout ?? 15_000
    const mailbox =
      input.mailboxId === undefined
        ? await this.findMailboxByRole(input.mailboxRole ?? 'inbox')
        : await this.findMailboxById(input.mailboxId)
    const deadline = Date.now() + timeout
    let delay = 100
    for (;;) {
      const emails = await this.queryEmails(
        input.withoutSearch === true
          ? { inMailbox: mailbox.id }
          : { inMailbox: mailbox.id, subject: input.subject }
      )
      const match = emails.find(email => email.subject === input.subject)
      if (match !== undefined) {
        return match
      }
      if (Date.now() + delay > deadline) {
        throw new JmapError(
          `No email "${input.subject}" in ${mailbox.name} after ${timeout} ms (seen: ${JSON.stringify(emails.map(email => email.subject))})`,
          'timeout'
        )
      }
      await sleep(delay)
      delay = Math.min(delay * 2, 1_000)
    }
  }
}
