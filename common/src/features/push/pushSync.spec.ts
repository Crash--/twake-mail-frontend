import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query'
import { createClient, type JmapClient } from 'jmap-client-ts'

import {
  mailboxesQueryOptions,
  type MailboxListData
} from '@common/features/mailbox/queries'
import {
  EMAIL_LIST_PAGE_SIZE,
  emailListQueryOptions,
  threadKeys,
  type EmailListData,
  type EmailListPage
} from '@common/features/thread/queries'
import {
  FAKE_ACCOUNT_ID,
  FAKE_SESSION_URL,
  makeEmail,
  makeFakeJmapServer,
  type FakeEmail,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'

import { MAX_CHANGES_ROUNDS } from './fetchChanges'
import { createPushSync, type PushSync } from './pushSync'

const INBOX = 'mailbox-inbox'
const ARCHIVE = 'mailbox-archive'

/** `count` emails of the inbox, `e0` the most recent */
function makeEmails(count: number): FakeEmail[] {
  return Array.from({ length: count }, (_, index) =>
    makeEmail({
      id: `e${index}`,
      receivedAt: new Date(Date.UTC(2026, 8, 1) - index * 60_000).toISOString()
    })
  )
}

interface Setup {
  server: FakeJmapServer
  client: JmapClient
  queryClient: QueryClient
  sync: PushSync
}

async function makeSetup(
  init: Parameters<typeof makeFakeJmapServer>[0] = {}
): Promise<Setup> {
  const server = makeFakeJmapServer(init)
  const client = createClient({
    sessionUrl: FAKE_SESSION_URL,
    auth: { getAuthorizationHeader: () => Promise.resolve('Basic dGVzdA==') },
    fetch: server.fetch
  })
  await client.getSession()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } }
  })
  const sync = createPushSync(queryClient, client, FAKE_ACCOUNT_ID)
  return { server, client, queryClient, sync }
}

async function loadInbox(
  { client, queryClient }: Setup,
  pages: number
): Promise<void> {
  await queryClient.infiniteQuery({
    ...emailListQueryOptions(client, FAKE_ACCOUNT_ID, INBOX),
    pages
  })
}

function inboxData({ queryClient }: Setup): EmailListData {
  const data = queryClient.getQueryData<EmailListData>(
    threadKeys.list(FAKE_ACCOUNT_ID, INBOX)
  )
  if (!data) throw new Error('No inbox list in the cache')
  return data
}

function listedIds(setup: Setup): string[] {
  return inboxData(setup).pages.flatMap(page =>
    page.emails.map(email => email.id)
  )
}

/** The ids of the inbox as the server sorts them */
function serverInboxIds({ server }: Setup): string[] {
  return server.emails
    .filter(email => INBOX in email.mailboxIds)
    .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt))
    .map(email => email.id)
}

/** Methods of the requests sent since `from` */
function methodsSince({ server }: Setup, from: number): string[][] {
  return server.requests
    .slice(from)
    .map(request => request.methodCalls.map(([name]) => name))
}

async function pushNow({ server, sync }: Setup): Promise<void> {
  sync.stateChanged(server.states())
  await sync.whenIdle()
}

async function until(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (condition()) return
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  throw new Error('Condition not met')
}

function lastPage(setup: Setup): EmailListPage {
  const { pages } = inboxData(setup)
  const page = pages[pages.length - 1]
  if (!page) throw new Error('No page')
  return page
}

describe('createPushSync', () => {
  it('patches every loaded page from the email changes, in one request', async () => {
    const setup = await makeSetup({
      emails: makeEmails(EMAIL_LIST_PAGE_SIZE * 2 + 5)
    })
    await loadInbox(setup, 2)
    const { server } = setup
    const before = server.requests.length

    server.addEmail(
      makeEmail({ id: 'new', receivedAt: '2026-09-02T00:00:00Z' })
    )
    server.updateEmail('e40', { keywords: { $seen: true } })
    server.updateEmail('e45', { mailboxIds: { [ARCHIVE]: true } })
    server.destroyEmail('e50')
    await pushNow(setup)

    expect(methodsSince(setup, before)).toEqual([
      ['Email/changes', 'Email/get', 'Email/get']
    ])
    const ids = listedIds(setup)
    expect(ids[0]).toBe('new')
    expect(ids).not.toContain('e45')
    expect(ids).not.toContain('e50')
    expect(
      inboxData(setup).pages[1]?.emails.find(email => email.id === 'e40')
        ?.keywords
    ).toEqual({ $seen: true })
    expect(inboxData(setup).pages.map(page => page.state)).toEqual([
      server.states().Email,
      server.states().Email
    ])

    // The next page starts where the server now puts it: no gap, no repeat
    const observer = new InfiniteQueryObserver(
      setup.queryClient,
      emailListQueryOptions(setup.client, FAKE_ACCOUNT_ID, INBOX)
    )
    await observer.fetchNextPage()
    expect(listedIds(setup)).toEqual(serverInboxIds(setup))
  })

  it('sends nothing when the cache is already at the pushed state', async () => {
    const setup = await makeSetup({ emails: makeEmails(3) })
    await loadInbox(setup, 1)
    await setup.queryClient.query(
      mailboxesQueryOptions(setup.client, FAKE_ACCOUNT_ID)
    )
    const before = setup.server.requests.length

    await pushNow(setup)

    expect(setup.server.requests.length).toBe(before)
  })

  it('patches the mailboxes from their changes', async () => {
    const setup = await makeSetup()
    await setup.queryClient.query(
      mailboxesQueryOptions(setup.client, FAKE_ACCOUNT_ID)
    )
    const before = setup.server.requests.length

    setup.server.updateMailbox(INBOX, { unreadEmails: 9 })
    await pushNow(setup)

    expect(methodsSince(setup, before)).toEqual([
      ['Mailbox/changes', 'Mailbox/get', 'Mailbox/get']
    ])
    const data = setup.queryClient.getQueryData<MailboxListData>([
      'mailbox',
      FAKE_ACCOUNT_ID,
      'list'
    ])
    expect(data?.list.find(mailbox => mailbox.id === INBOX)?.unreadEmails).toBe(
      9
    )
    expect(data?.state).toBe(setup.server.states().Mailbox)
  })

  it('follows the changes over several requests while the server has more', async () => {
    const setup = await makeSetup({ emails: makeEmails(3), maxChanges: 1 })
    await loadInbox(setup, 1)
    const before = setup.server.requests.length

    for (const id of ['n1', 'n2', 'n3']) {
      setup.server.addEmail(
        makeEmail({ id, receivedAt: '2026-09-02T00:00:00Z' })
      )
    }
    await pushNow(setup)

    expect(methodsSince(setup, before)).toHaveLength(3)
    expect(listedIds(setup)).toEqual(serverInboxIds(setup))
  })

  it.each([
    ['the server cannot calculate the changes', 'cannotCalculateChanges'],
    ['the state is unknown to the server', 'invalidArguments']
  ])('refetches the first page only when %s', async (_case, errorType) => {
    const setup = await makeSetup({
      emails: makeEmails(EMAIL_LIST_PAGE_SIZE * 2 + 5)
    })
    const observer = new InfiniteQueryObserver(
      setup.queryClient,
      emailListQueryOptions(setup.client, FAKE_ACCOUNT_ID, INBOX)
    )
    const unsubscribe = observer.subscribe(() => undefined)
    await until(() => observer.getCurrentResult().isSuccess)
    await observer.fetchNextPage()
    setup.server.methodErrors.set('Email/changes', errorType)
    const before = setup.server.requests.length

    setup.server.addEmail(
      makeEmail({ id: 'new', receivedAt: '2026-09-02T00:00:00Z' })
    )
    await pushNow(setup)
    await until(() => listedIds(setup)[0] === 'new')

    expect(inboxData(setup).pages).toHaveLength(1)
    expect(methodsSince(setup, before)).toEqual([
      ['Email/changes', 'Email/get', 'Email/get'],
      ['Email/query', 'Email/get']
    ])
    unsubscribe()
  })

  it('refetches only the lists whose state the server no longer knows', async () => {
    const setup = await makeSetup({
      emails: makeEmails(EMAIL_LIST_PAGE_SIZE * 2 + 5)
    })
    await loadInbox(setup, 2)
    // A folder visited long ago, at a state the server cannot start from
    const archiveKey = threadKeys.list(FAKE_ACCOUNT_ID, ARCHIVE)
    const stale: EmailListPage = {
      emails: [],
      position: 0,
      count: 0,
      total: null,
      isLast: false,
      state: 'state-email-999'
    }
    setup.queryClient.setQueryData<EmailListData>(archiveKey, {
      pages: [stale, { ...stale, position: 0 }],
      pageParams: [0, 0]
    })

    setup.server.addEmail(
      makeEmail({ id: 'new', receivedAt: '2026-09-02T00:00:00Z' })
    )
    await pushNow(setup)

    expect(listedIds(setup)[0]).toBe('new')
    expect(inboxData(setup).pages).toHaveLength(2)
    expect(
      setup.queryClient.getQueryData<EmailListData>(archiveKey)?.pages
    ).toHaveLength(1)
    expect(setup.queryClient.getQueryState(archiveKey)?.isInvalidated).toBe(
      true
    )
  })

  it('refetches the first page when the changes never end', async () => {
    const setup = await makeSetup({ emails: makeEmails(3), maxChanges: 1 })
    await loadInbox(setup, 1)

    for (let index = 0; index <= MAX_CHANGES_ROUNDS; index++) {
      setup.server.addEmail(
        makeEmail({ id: `n${index}`, receivedAt: '2026-09-02T00:00:00Z' })
      )
    }
    await pushNow(setup)

    const state = setup.queryClient.getQueryState(
      threadKeys.list(FAKE_ACCOUNT_ID, INBOX)
    )
    expect(state?.isInvalidated).toBe(true)
  })

  it('catches up a page fetched while the changes were applied', async () => {
    const setup = await makeSetup({
      emails: makeEmails(EMAIL_LIST_PAGE_SIZE * 2 + 5)
    })
    const observer = new InfiniteQueryObserver(
      setup.queryClient,
      emailListQueryOptions(setup.client, FAKE_ACCOUNT_ID, INBOX)
    )
    const unsubscribe = observer.subscribe(() => undefined)
    await until(() => observer.getCurrentResult().isSuccess)

    // The next page is in flight when the push is applied: TanStack Query
    // builds its result on the pages it started from, without the patch
    const release = setup.server.holdRequests('Email/query')
    const nextPage = observer.fetchNextPage()
    setup.server.addEmail(
      makeEmail({ id: 'new', receivedAt: '2026-09-02T00:00:00Z' })
    )
    await pushNow(setup)
    expect(listedIds(setup)[0]).toBe('new')
    release()
    await nextPage
    await setup.sync.whenIdle()

    const ids = listedIds(setup)
    expect(ids[0]).toBe('new')
    expect(new Set(ids).size).toBe(ids.length)
    expect(lastPage(setup).position + lastPage(setup).count).toBe(ids.length)
    await observer.fetchNextPage()
    expect(listedIds(setup)).toEqual(serverInboxIds(setup))
    unsubscribe()
  })

  it('catches up the changes made while the push channel was down', async () => {
    const setup = await makeSetup({ emails: makeEmails(3) })
    await loadInbox(setup, 1)

    setup.server.addEmail(
      makeEmail({ id: 'new', receivedAt: '2026-09-02T00:00:00Z' })
    )
    setup.sync.catchUp()
    await setup.sync.whenIdle()

    expect(listedIds(setup)).toEqual(serverInboxIds(setup))
  })

  it('patches the opened email, and empties it once destroyed', async () => {
    const setup = await makeSetup({ emails: makeEmails(3) })
    await loadInbox(setup, 1)
    const key = ['email', FAKE_ACCOUNT_ID, 'detail', 'e1']
    setup.queryClient.setQueryData(key, {
      ...makeEmail({ id: 'e1' }),
      bcc: null
    })

    setup.server.updateEmail('e1', { keywords: { $flagged: true } })
    await pushNow(setup)
    expect(
      setup.queryClient.getQueryData<{ keywords: object }>(key)?.keywords
    ).toEqual({ $flagged: true })

    setup.server.destroyEmail('e1')
    await pushNow(setup)
    expect(setup.queryClient.getQueryData(key)).toBe(null)
  })
})
