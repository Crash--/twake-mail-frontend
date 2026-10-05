import {
  createClient,
  JmapSetError,
  type EmailAddress,
  type EmailCreate,
  type FetchFunction,
  type JmapClient
} from 'jmap-client-ts'
import { LINAGORA_METHOD_CAPABILITIES } from 'jmap-client-ts/linagora'

import {
  FAKE_ACCOUNT_ID,
  FAKE_SESSION_URL,
  makeEmail,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'

import {
  buildEmail,
  identityReplyTo,
  saveDraft,
  sendEmail,
  type BuildPurpose,
  type ComposedMessage
} from './composeEmail'
import { InlineImageStore } from './InlineImageStore'

const MAILBOX_IDS = { drafts: 'mailbox-drafts', sent: 'mailbox-sent' }

function makeClient(server: FakeJmapServer, fetch?: FetchFunction): JmapClient {
  return createClient({
    sessionUrl: FAKE_SESSION_URL,
    fetch: fetch ?? server.fetch,
    methodCapabilities: LINAGORA_METHOD_CAPABILITIES
  })
}

function draft(subject: string): EmailCreate {
  return {
    mailboxIds: { [MAILBOX_IDS.drafts]: true },
    keywords: { $draft: true, $seen: true },
    from: [{ name: null, email: 'alice@example.com' }],
    to: [{ name: null, email: 'bob@example.com' }],
    subject,
    bodyValues: { text: { value: subject } },
    textBody: [{ partId: 'text', type: 'text/plain' }]
  }
}

function serverWithDraft(): FakeJmapServer {
  return makeFakeJmapServer({
    emails: [
      makeEmail({
        id: 'draft-old',
        mailboxIds: { [MAILBOX_IDS.drafts]: true },
        keywords: { $draft: true, $seen: true },
        subject: 'Old version'
      })
    ]
  })
}

function subjectsOf(server: FakeJmapServer): (string | null)[] {
  return server.emails
    .filter(email => MAILBOX_IDS.drafts in email.mailboxIds)
    .map(email => email.subject)
}

/** Whether any request sent so far destroyed something */
function destroyCalls(server: FakeJmapServer): unknown[] {
  return server.requests
    .flatMap(request => request.methodCalls)
    .filter(([name, args]) => name === 'Email/set' && 'destroy' in args)
    .map(([, args]) => args.destroy)
}

/** A fetch losing the requests that destroy emails, while `failing` */
function losingDestroys(
  server: FakeJmapServer,
  state: { failing: boolean }
): FetchFunction {
  return async (input, init) => {
    const body = typeof init?.body === 'string' ? init.body : ''
    if (state.failing && body.includes('"destroy"')) {
      throw new TypeError('Network error')
    }
    return server.fetch(input, init)
  }
}

describe('saveDraft', () => {
  let warn: jest.SpyInstance

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('creates the new version, then destroys the previous one in a second request', async () => {
    const server = serverWithDraft()
    const client = makeClient(server)

    const result = await saveDraft(
      client,
      FAKE_ACCOUNT_ID,
      draft('New version'),
      ['draft-old'],
      new InlineImageStore(client, FAKE_ACCOUNT_ID)
    )

    expect(subjectsOf(server)).toEqual(['New version'])
    expect(result.leftovers).toEqual([])
    const [save, destroy] = server.requests.slice(-2)
    expect(save?.methodCalls.map(([name]) => name)).toEqual([
      'Email/set',
      'Email/get'
    ])
    expect(save?.methodCalls[0]?.[1]).not.toHaveProperty('destroy')
    expect(destroy?.methodCalls).toEqual([
      [
        'Email/set',
        { accountId: FAKE_ACCOUNT_ID, destroy: ['draft-old'] },
        expect.any(String)
      ]
    ])
  })

  it('leaves the previous version untouched when the creation is refused', async () => {
    const server = serverWithDraft()
    server.setErrors.set('draft', 'overQuota')
    const client = makeClient(server)

    const saving = saveDraft(
      client,
      FAKE_ACCOUNT_ID,
      draft('Too big'),
      ['draft-old'],
      new InlineImageStore(client, FAKE_ACCOUNT_ID)
    )

    await expect(saving).rejects.toBeInstanceOf(JmapSetError)
    await expect(saving).rejects.toMatchObject({
      notCreated: { draft: { type: 'overQuota' } }
    })
    expect(subjectsOf(server)).toEqual(['Old version'])
    expect(destroyCalls(server)).toEqual([])
  })

  it('returns the previous version when its destruction is refused, and destroys it with the next save', async () => {
    const server = serverWithDraft()
    server.setErrors.set('draft-old', 'forbidden')
    const client = makeClient(server)
    const images = new InlineImageStore(client, FAKE_ACCOUNT_ID)

    const first = await saveDraft(
      client,
      FAKE_ACCOUNT_ID,
      draft('Second'),
      ['draft-old'],
      images
    )
    expect(first.leftovers).toEqual(['draft-old'])
    expect(subjectsOf(server)).toEqual(['Old version', 'Second'])

    server.setErrors.clear()
    const second = await saveDraft(
      client,
      FAKE_ACCOUNT_ID,
      draft('Third'),
      [first.emailId, ...first.leftovers],
      images
    )
    expect(second.leftovers).toEqual([])
    expect(subjectsOf(server)).toEqual(['Third'])
  })

  it('returns the previous version when the destroy request is lost', async () => {
    const server = serverWithDraft()
    const state = { failing: true }
    const client = makeClient(server, losingDestroys(server, state))
    const images = new InlineImageStore(client, FAKE_ACCOUNT_ID)

    const first = await saveDraft(
      client,
      FAKE_ACCOUNT_ID,
      draft('Second'),
      ['draft-old'],
      images
    )
    expect(first.leftovers).toEqual(['draft-old'])
    expect(subjectsOf(server)).toEqual(['Old version', 'Second'])

    state.failing = false
    const second = await saveDraft(
      client,
      FAKE_ACCOUNT_ID,
      draft('Third'),
      [first.emailId, ...first.leftovers],
      images
    )
    expect(second.leftovers).toEqual([])
    expect(subjectsOf(server)).toEqual(['Third'])
  })

  it('does not keep a previous version already gone', async () => {
    const server = makeFakeJmapServer()
    const client = makeClient(server)

    const result = await saveDraft(
      client,
      FAKE_ACCOUNT_ID,
      draft('Alone'),
      ['draft-destroyed-elsewhere'],
      new InlineImageStore(client, FAKE_ACCOUNT_ID)
    )

    expect(result.leftovers).toEqual([])
    expect(subjectsOf(server)).toEqual(['Alone'])
  })
})

describe('sendEmail', () => {
  it('keeps every version of the draft when the message is not created', async () => {
    const server = serverWithDraft()
    server.setErrors.set('message', 'tooLarge')
    const client = makeClient(server)

    const result = await sendEmail(
      client,
      FAKE_ACCOUNT_ID,
      'identity-alice',
      draft('Too large'),
      MAILBOX_IDS,
      ['draft-old']
    )

    expect(result).toMatchObject({
      ok: false,
      reason: 'tooLarge',
      draftId: null,
      leftovers: ['draft-old']
    })
    expect(subjectsOf(server)).toEqual(['Old version'])
    expect(destroyCalls(server)).toEqual([])
  })

  it('destroys every previous version of the draft once the message is created', async () => {
    const server = makeFakeJmapServer({
      emails: ['draft-old', 'draft-left'].map(id =>
        makeEmail({
          id,
          mailboxIds: { [MAILBOX_IDS.drafts]: true },
          keywords: { $draft: true, $seen: true }
        })
      )
    })
    const client = makeClient(server)

    const result = await sendEmail(
      client,
      FAKE_ACCOUNT_ID,
      'identity-alice',
      draft('Sent'),
      MAILBOX_IDS,
      ['draft-old', 'draft-left']
    )

    expect(result.ok).toBe(true)
    expect(subjectsOf(server)).toEqual([])
  })
})

describe('buildEmail', () => {
  const message: ComposedMessage = {
    identityId: 'identity-alice',
    from: { name: 'Alice', email: 'alice@example.com' },
    to: [{ name: null, email: 'bob@example.com' }],
    subject: 'Options',
    editorHtml: '<p>Hello</p>',
    inReplyTo: null,
    references: null,
    readReceiptTo: 'alice@example.com',
    isImportant: true,
    identityReplyTo: [{ name: 'Alice', email: 'alice@example.com' }]
  }

  function build(
    input: ComposedMessage,
    purpose: BuildPurpose
  ): Promise<EmailCreate> {
    const server = makeFakeJmapServer()
    const images = new InlineImageStore(makeClient(server), FAKE_ACCOUNT_ID)
    return buildEmail(input, images, MAILBOX_IDS, purpose)
  }

  it('asks a read receipt and marks it important as tmail-flutter', async () => {
    const email = await build(message, 'send')

    expect(email).toMatchObject({
      'header:Disposition-Notification-To:asText': 'alice@example.com',
      'header:Return-Path:asText': 'alice@example.com',
      'header:X-Priority:asText': '1',
      'header:Importance:asText': 'high',
      'header:Priority:asText': 'urgent'
    })
    const plain = await build(
      { ...message, readReceiptTo: null, isImportant: false },
      'send'
    )
    expect(Object.keys(plain).filter(key => key.startsWith('header:'))).toEqual(
      ['header:X-JMAP-Identity:asText']
    )
  })

  it('sends with the Reply-To of the identity when none is typed, drafts without', async () => {
    expect((await build(message, 'send')).replyTo).toEqual([
      { name: 'Alice', email: 'alice@example.com' }
    ])
    expect((await build(message, 'draft')).replyTo).toBe(null)
    const typed = [{ name: null, email: 'replies@example.com' }]
    expect(
      (await build({ ...message, replyTo: typed }, 'send')).replyTo
    ).toEqual(typed)
  })
})

describe('identityReplyTo', () => {
  it('names the Reply-To of the identity after it, else answers to the identity', () => {
    const identity = {
      name: 'Support',
      email: 'alice@example.com',
      // James leaves out the name it does not have
      replyTo: [{ email: 'replies@example.com' } as EmailAddress]
    }
    expect(identityReplyTo(identity)).toEqual([
      { name: 'Support', email: 'replies@example.com' }
    ])
    expect(identityReplyTo({ ...identity, replyTo: null })).toEqual([
      { name: 'Support', email: 'alice@example.com' }
    ])
    expect(identityReplyTo(undefined)).toEqual([])
  })
})
