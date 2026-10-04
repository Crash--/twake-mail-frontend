/**
 * Provisions a user with a large mailbox for the performance measures (`perf/`): 5 000 emails
 * in the Inbox and 500 in a "Perf folder" by default, varied (subject and body lengths, senders,
 * 15 % with an attachment, 30 % unread, 8 % starred), received over the last months.
 *
 * Test provisioning, not mail delivery: the emails are created with `Email/set` (`receivedAt`,
 * `keywords` and `mailboxIds` set directly) by batches of 250, four requests at a time; the
 * attachment is uploaded once and shared by every email that has one. About 30 s for 5 500
 * emails on the memory backend.
 *
 *   npm run perf:seed                                  # 5000 + 500, credentials in perf/.perf-user.json
 *   npm run perf:seed -- --inbox 2000 --other 0 --out /tmp/user.json
 *
 * Needs the stack (scripts/start.sh), and leaves it unfit for the e2e suite (README, "Known
 * backend quirks"). Standalone on purpose (fetch only, no import): Node 24 runs it as is, and
 * the perf global setup imports `seedPerfUser`.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export interface PerfUser {
  email: string
  password: string
  inboxId: string
  otherMailboxId: string
  inboxCount: number
  otherCount: number
  /** Milliseconds the provisioning took */
  seedMs: number
}

export interface SeedOptions {
  inbox?: number
  other?: number
  jmapUrl?: string
  webadminUrl?: string
  domain?: string
}

const USING = ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail']
const BATCH_SIZE = 250
const CONCURRENCY = 4

const FIRST_NAMES = ['Alice', 'Bob', 'Chloé', 'David', 'Emma', 'Farid', 'Gaëlle', 'Hugo',
  'Inès', 'Jules', 'Katia', 'Louis', 'Manon', 'Nadia', 'Olivier', 'Pauline', 'Quentin',
  'Rania', 'Sacha', 'Théo', 'Ursula', 'Victor', 'Wen', 'Xavier', 'Yasmine', 'Zoé']
const LAST_NAMES = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit',
  'Durand', 'Leroy', 'Moreau', 'Nguyen', 'Ivanova']
const WORDS = ('quarterly report meeting agenda invoice project roadmap release review '
  + 'budget planning feedback contract proposal deadline update reminder schedule '
  + 'deployment incident customer support onboarding design specification migration '
  + 'security audit invitation webinar newsletter holiday training workshop').split(' ')

/** Deterministic pseudo random numbers: the same mailbox at every run */
function makeRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function sentence(random: () => number, minWords: number, maxWords: number): string {
  const count = minWords + Math.floor(random() * (maxWords - minWords + 1))
  const words = Array.from({ length: count }, () => WORDS[Math.floor(random() * WORDS.length)])
  const text = words.join(' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

class SeedClient {
  readonly #jmapUrl: string
  readonly #authorization: string

  constructor(jmapUrl: string, email: string, password: string) {
    this.#jmapUrl = jmapUrl
    this.#authorization = `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`
  }

  async accountId(): Promise<string> {
    const response = await fetch(`${this.#jmapUrl}/jmap/session`, {
      headers: { Authorization: this.#authorization, Accept: 'application/json' }
    })
    const session: unknown = await response.json()
    if (!isRecord(session) || !isRecord(session.primaryAccounts)) {
      throw new Error(`Unexpected session: ${JSON.stringify(session)}`)
    }
    const accountId = session.primaryAccounts['urn:ietf:params:jmap:mail']
    if (typeof accountId !== 'string') throw new Error('No mail account')
    return accountId
  }

  async call(method: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.#jmapUrl}/jmap`, {
      method: 'POST',
      headers: {
        Authorization: this.#authorization,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ using: USING, methodCalls: [[method, args, '0']] })
    })
    const body: unknown = await response.json()
    const invocation = isRecord(body) && Array.isArray(body.methodResponses)
      ? body.methodResponses[0]
      : null
    if (!Array.isArray(invocation) || invocation[0] !== method || !isRecord(invocation[1])) {
      throw new Error(`${method} failed: ${JSON.stringify(body).slice(0, 500)}`)
    }
    return invocation[1]
  }

  async upload(accountId: string, content: Buffer, type: string): Promise<string> {
    const response = await fetch(`${this.#jmapUrl}/upload/${encodeURIComponent(accountId)}`, {
      method: 'POST',
      headers: { Authorization: this.#authorization, 'Content-Type': type },
      body: new Uint8Array(content)
    })
    const body: unknown = await response.json()
    if (!isRecord(body) || typeof body.blobId !== 'string') {
      throw new Error(`Upload failed: ${JSON.stringify(body)}`)
    }
    return body.blobId
  }
}

async function webadmin(url: string, method: string, body?: unknown): Promise<void> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  if (!response.ok) throw new Error(`${method} ${url}: ${response.status} ${await response.text()}`)
}

function makeEmail(
  index: number,
  mailboxId: string,
  receivedAt: Date,
  to: string,
  attachmentBlobId: string,
  random: () => number
): Record<string, unknown> {
  const first = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)]
  const last = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)]
  const hasAttachment = random() < 0.15
  const keywords: Record<string, boolean> = {}
  if (random() >= 0.3) keywords.$seen = true
  if (random() < 0.08) keywords.$flagged = true
  // From one word to long subjects that need an ellipsis, bodies from empty to long
  const subject = `${sentence(random, 1, random() < 0.2 ? 20 : 8)} #${index}`
  const paragraphs = Math.floor(random() * 6)
  const body = Array.from({ length: paragraphs }, () => sentence(random, 5, 60)).join('\n\n')
  return {
    mailboxIds: { [mailboxId]: true },
    keywords,
    receivedAt: receivedAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    subject,
    from: [{ name: `${first} ${last}`, email: `${first}.${last}@example.org`.normalize('NFD').replace(/[^\x00-\x7f]/g, '').toLowerCase() }],
    to: [{ email: to }],
    bodyValues: { text: { value: body } },
    textBody: [{ partId: 'text', type: 'text/plain' }],
    ...(hasAttachment
      ? {
          attachments: [
            { blobId: attachmentBlobId, type: 'application/pdf', name: `report-${index}.pdf`, disposition: 'attachment' }
          ]
        }
      : {})
  }
}

async function createEmails(
  client: SeedClient,
  accountId: string,
  mailboxId: string,
  count: number,
  to: string,
  attachmentBlobId: string,
  seed: number
): Promise<void> {
  const random = makeRandom(seed)
  // Most recent first, 5 to 95 minutes apart: 5 000 emails span about six months
  const emails: Record<string, unknown>[] = []
  let date = Date.now() - 60_000
  for (let index = 0; index < count; index += 1) {
    emails.push(makeEmail(index, mailboxId, new Date(date), to, attachmentBlobId, random))
    date -= (5 + Math.floor(random() * 90)) * 60_000
  }
  const batches: Record<string, unknown>[][] = []
  for (let start = 0; start < emails.length; start += BATCH_SIZE) {
    batches.push(emails.slice(start, start + BATCH_SIZE))
  }
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < batches.length) {
      const batch = batches[next]
      next += 1
      if (batch === undefined) return
      const create = Object.fromEntries(batch.map((email, index) => [`e${index}`, email]))
      const result = await client.call('Email/set', { accountId, create })
      const notCreated = result.notCreated
      if (isRecord(notCreated) && Object.keys(notCreated).length > 0) {
        throw new Error(`Email/set refused emails: ${JSON.stringify(notCreated).slice(0, 500)}`)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
}

/** Creates the perf user and fills its mailboxes */
export async function seedPerfUser(options: SeedOptions = {}): Promise<PerfUser> {
  const started = Date.now()
  const jmapUrl = options.jmapUrl ?? process.env.E2E_JMAP_URL ?? 'http://127.0.0.1:18300'
  const webadminUrl = options.webadminUrl ?? process.env.E2E_WEBADMIN_URL ?? 'http://127.0.0.1:18301'
  const domain = options.domain ?? process.env.E2E_DOMAIN ?? 'example.com'
  const inboxCount = options.inbox ?? 5000
  const otherCount = options.other ?? 500

  const email = `perf-${randomUUID()}@${domain}`
  const password = randomBytes(18).toString('base64url')
  await webadmin(`${webadminUrl}/users/${encodeURIComponent(email)}`, 'PUT', { password })
  // The default quota of the stack would refuse thousands of emails
  await webadmin(`${webadminUrl}/quota/users/${encodeURIComponent(email)}`, 'PUT', { count: -1, size: -1 })

  const client = new SeedClient(jmapUrl, email, password)
  const accountId = await client.accountId()
  const mailboxes = await client.call('Mailbox/get', { accountId, properties: ['role', 'name'] })
  const list = Array.isArray(mailboxes.list) ? mailboxes.list.filter(isRecord) : []
  const inbox = list.find(mailbox => mailbox.role === 'inbox')
  if (inbox === undefined || typeof inbox.id !== 'string') throw new Error('No inbox')
  const created = await client.call('Mailbox/set', {
    accountId,
    create: { other: { name: 'Perf folder', parentId: null } }
  })
  const otherId = isRecord(created.created) && isRecord(created.created.other)
    ? created.created.other.id
    : null
  if (typeof otherId !== 'string') throw new Error(`Mailbox/set failed: ${JSON.stringify(created)}`)

  const attachment = Buffer.concat([
    Buffer.from('%PDF-1.4\n'),
    randomBytes(20_000)
  ])
  const attachmentBlobId = await client.upload(accountId, attachment, 'application/pdf')

  await createEmails(client, accountId, inbox.id, inboxCount, email, attachmentBlobId, 1)
  await createEmails(client, accountId, otherId, otherCount, email, attachmentBlobId, 2)

  return {
    email,
    password,
    inboxId: inbox.id,
    otherMailboxId: otherId,
    inboxCount,
    otherCount,
    seedMs: Date.now() - started
  }
}

/**
 * Creates an email in the Inbox of the perf user, as if it had just arrived: what the push
 * measure waits for. `Email/set` create rather than a submission: see the README, "Known
 * backend quirks" (updates, hence `onSuccessUpdateEmail`, hang on a big memory backend).
 */
export async function createInboxEmail(
  user: Pick<PerfUser, 'email' | 'password' | 'inboxId'>,
  subject: string,
  jmapUrl: string = process.env.E2E_JMAP_URL ?? 'http://127.0.0.1:18300'
): Promise<string> {
  const client = new SeedClient(jmapUrl, user.email, user.password)
  const accountId = await client.accountId()
  const result = await client.call('Email/set', {
    accountId,
    create: {
      pushed: {
        mailboxIds: { [user.inboxId]: true },
        keywords: {},
        subject,
        from: [{ name: 'Push Sender', email: 'push.sender@example.org' }],
        to: [{ email: user.email }],
        bodyValues: { text: { value: 'Just arrived' } },
        textBody: [{ partId: 'text', type: 'text/plain' }]
      }
    }
  })
  const created = isRecord(result.created) && isRecord(result.created.pushed) ? result.created.pushed.id : null
  if (typeof created !== 'string') throw new Error(`Email/set failed: ${JSON.stringify(result)}`)
  return created
}

/** True when the stored perf user still exists on the stack (it does not survive stop.sh) */
export async function perfUserExists(
  user: Pick<PerfUser, 'email' | 'password'>,
  jmapUrl: string = process.env.E2E_JMAP_URL ?? 'http://127.0.0.1:18300'
): Promise<boolean> {
  const response = await fetch(`${jmapUrl}/jmap/session`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${user.email}:${user.password}`).toString('base64')}`,
      Accept: 'application/json'
    }
  })
  return response.ok
}

function readArgument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

const isMain = process.argv[1]?.endsWith('seed-perf.ts') === true
if (isMain) {
  const out = path.resolve(readArgument('out') ?? 'perf/.perf-user.json')
  const inbox = readArgument('inbox')
  const other = readArgument('other')
  seedPerfUser({
    inbox: inbox === undefined ? undefined : Number(inbox),
    other: other === undefined ? undefined : Number(other)
  })
    .then(user => {
      mkdirSync(path.dirname(out), { recursive: true })
      writeFileSync(out, `${JSON.stringify(user, null, 2)}\n`)
      console.log(
        `${user.email}: ${user.inboxCount} emails in the Inbox, ${user.otherCount} in "Perf folder", ` +
          `seeded in ${(user.seedMs / 1000).toFixed(1)} s. Credentials: ${out}`
      )
    })
    .catch((error: unknown) => {
      console.error(error)
      process.exitCode = 1
    })
}
