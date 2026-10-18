import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query'
import { createClient, type JmapClient } from 'jmap-client-ts'
import { LINAGORA_METHOD_CAPABILITIES } from 'jmap-client-ts/linagora'

import {
  applyEmailChanges,
  findListRows
} from '@common/features/emailActions/optimisticEmailChanges'
import type { TargetEmail } from '@common/features/emailActions/planEmailChanges'
import { sendEmailChanges } from '@common/features/emailActions/sendEmailChanges'
import { emailQueryOptions } from '@common/features/email/queries'
import {
  mailboxesQueryOptions,
  type MailboxListData
} from '@common/features/mailbox/queries'
import { emailListSourceQueryOptions } from '@common/features/thread/emailListSource'
import {
  conversationKeys,
  conversationQueryOptions,
  EMAIL_LIST_PAGE_SIZE,
  emailListQueryOptions,
  threadKeys,
  type ConversationData,
  type EmailListData,
  type EmailListPage,
  type SearchRequest
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
import { MAX_OWN_STATES, ownStatesOf } from './ownStates'
import { createPushSync, OWN_SET_WAIT_MS, type PushSync } from './pushSync'

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
  /**
   * Holds the answers of the next `Email/set` once the server applied it,
   * as James answers after its push; returns the call that lets them go
   */
  holdSetAnswers: () => () => void
  client: JmapClient
  queryClient: QueryClient
  sync: PushSync
}

async function makeSetup(
  init: Parameters<typeof makeFakeJmapServer>[0] = {}
): Promise<Setup> {
  const server = makeFakeJmapServer(init)
  let answersHeld: Promise<void> | null = null
  const holdSetAnswers = (): (() => void) => {
    let release = (): void => undefined
    answersHeld = new Promise<void>(resolve => {
      release = resolve
    })
    return release
  }
  const client = createClient({
    sessionUrl: FAKE_SESSION_URL,
    auth: { getAuthorizationHeader: () => Promise.resolve('Basic dGVzdA==') },
    fetch: async (input, init) => {
      const response = await server.fetch(input, init)
      const held = answersHeld
      const body = init?.body
      if (
        held !== null &&
        typeof body === 'string' &&
        body.includes('"Email/set"')
      ) {
        answersHeld = null
        await held
      }
      return response
    },
    methodCapabilities: LINAGORA_METHOD_CAPABILITIES
  })
  await client.getSession()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } }
  })
  const sync = createPushSync(queryClient, client, FAKE_ACCOUNT_ID)
  return { server, holdSetAnswers, client, queryClient, sync }
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

/**
 * Changes an email as the email actions do: optimistic update, then
 * `Email/set`, its state change remembered when the update was complete
 */
async function changeOwnEmail(
  { client, queryClient }: Setup,
  before: TargetEmail,
  after: TargetEmail
): Promise<void> {
  const rows = findListRows(queryClient, FAKE_ACCOUNT_ID, [before.id])
  const isComplete = applyEmailChanges(
    queryClient,
    FAKE_ACCOUNT_ID,
    [{ before, after }],
    rows
  )
  const settle = isComplete
    ? ownStatesOf(client, FAKE_ACCOUNT_ID).track('Email')
    : null
  await sendEmailChanges(client, FAKE_ACCOUNT_ID, [{ before, after }], {
    batchSize: 50,
    ...(isComplete
      ? {
          onStateChanged: (oldState: string, newState: string) => {
            ownStatesOf(client, FAKE_ACCOUNT_ID).record(
              'Email',
              oldState,
              newState
            )
          }
        }
      : {})
  }).finally(() => {
    settle?.()
  })
}

/** Our own change sent, applied by the server, its answer held */
async function sendOwnChangeHeld(
  setup: Setup,
  [before, after]: [TargetEmail, TargetEmail]
): Promise<{ release: () => void; sent: Promise<void> }> {
  const release = setup.holdSetAnswers()
  const stateBefore = setup.server.states().Email
  const sent = changeOwnEmail(setup, before, after)
  await until(() => setup.server.states().Email !== stateBefore)
  return { release, sent }
}

function readEmail(id: string): [TargetEmail, TargetEmail] {
  return [
    { id, mailboxIds: { [INBOX]: true }, keywords: {} },
    { id, mailboxIds: { [INBOX]: true }, keywords: { $seen: true } }
  ]
}

function unreadEmail(id: string): [TargetEmail, TargetEmail] {
  const [unread, read] = readEmail(id)
  return [read, unread]
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

  describe('our own changes (tf#3394)', () => {
    it('takes the pushed state of our own change without Email/changes', async () => {
      const setup = await makeSetup({ emails: makeEmails(3) })
      await loadInbox(setup, 1)
      await changeOwnEmail(setup, ...readEmail('e1'))
      const before = setup.server.requests.length

      await pushNow(setup)

      expect(methodsSince(setup, before)).toEqual([])
      expect(inboxData(setup).pages.map(page => page.state)).toEqual([
        setup.server.states().Email
      ])
      expect(
        inboxData(setup).pages[0]?.emails.find(email => email.id === 'e1')
          ?.keywords
      ).toEqual({ $seen: true })
    })

    it('still reads the changes of the mailboxes our change moved', async () => {
      const setup = await makeSetup({ emails: makeEmails(3) })
      await loadInbox(setup, 1)
      await setup.queryClient.query(
        mailboxesQueryOptions(setup.client, FAKE_ACCOUNT_ID)
      )
      await changeOwnEmail(setup, ...readEmail('e1'))
      const before = setup.server.requests.length

      await pushNow(setup)

      const methods = methodsSince(setup, before).flat()
      expect(methods).not.toContain('Email/changes')
      expect(methods).toContain('Mailbox/changes')
    })

    it('takes a chain of our own changes pushed at once', async () => {
      const setup = await makeSetup({ emails: makeEmails(3) })
      await loadInbox(setup, 1)
      await changeOwnEmail(setup, ...readEmail('e0'))
      await changeOwnEmail(setup, ...readEmail('e1'))
      await changeOwnEmail(setup, ...readEmail('e2'))
      const before = setup.server.requests.length

      await pushNow(setup)

      expect(methodsSince(setup, before)).toEqual([])
      expect(lastPage(setup).state).toBe(setup.server.states().Email)
    })

    it('reads the changes made elsewhere', async () => {
      const setup = await makeSetup({ emails: makeEmails(3) })
      await loadInbox(setup, 1)
      const before = setup.server.requests.length

      setup.server.updateEmail('e1', { keywords: { $seen: true } })
      await pushNow(setup)

      expect(methodsSince(setup, before)).toEqual([
        ['Email/changes', 'Email/get', 'Email/get']
      ])
    })

    it('reads the changes when one made elsewhere comes between ours', async () => {
      const setup = await makeSetup({ emails: makeEmails(3) })
      await loadInbox(setup, 1)
      await changeOwnEmail(setup, ...readEmail('e0'))
      setup.server.updateEmail('e1', { keywords: { $flagged: true } })
      await changeOwnEmail(setup, ...readEmail('e2'))
      const before = setup.server.requests.length

      await pushNow(setup)

      expect(methodsSince(setup, before)).toEqual([
        ['Email/changes', 'Email/get', 'Email/get']
      ])
      expect(
        inboxData(setup).pages[0]?.emails.find(email => email.id === 'e1')
          ?.keywords
      ).toEqual({ $flagged: true })
    })

    it('reads only the change made elsewhere after ours', async () => {
      const setup = await makeSetup({ emails: makeEmails(3) })
      await loadInbox(setup, 1)
      await changeOwnEmail(setup, ...readEmail('e0'))
      await pushNow(setup)
      const ownState = lastPage(setup).state
      const before = setup.server.requests.length

      setup.server.updateEmail('e1', { keywords: { $flagged: true } })
      await pushNow(setup)

      const changes = setup.server.requests
        .slice(before)
        .flatMap(request => request.methodCalls)
        .find(([name]) => name === 'Email/changes')
      expect(changes?.[1]).toMatchObject({ sinceState: ownState })
    })

    it('reads the changes once our oldest change is forgotten', async () => {
      const setup = await makeSetup({ emails: makeEmails(3) })
      await loadInbox(setup, 1)
      for (let index = 0; index <= MAX_OWN_STATES; index++) {
        await changeOwnEmail(
          setup,
          ...(index % 2 === 0 ? readEmail('e1') : unreadEmail('e1'))
        )
      }
      const before = setup.server.requests.length

      await pushNow(setup)

      expect(methodsSince(setup, before)[0]).toContain('Email/changes')
    })

    it('waits for the answer of our own change when its push comes first', async () => {
      const setup = await makeSetup({ emails: makeEmails(3) })
      await loadInbox(setup, 1)
      const { release, sent } = await sendOwnChangeHeld(setup, readEmail('e1'))
      const before = setup.server.requests.length

      setup.sync.stateChanged(setup.server.states())
      release()
      await sent
      await setup.sync.whenIdle()

      expect(methodsSince(setup, before)).toEqual([])
      expect(lastPage(setup).state).toBe(setup.server.states().Email)
    })

    it('opens an unread email from a list of conversations: its push needs no Email/changes', async () => {
      // The path of the reading view: the conversations of the Inbox, the
      // conversation and the email opened, marked read, its push first
      const setup = await makeSetup({
        emails: [
          makeEmail({
            id: 't1',
            threadId: 'thread',
            receivedAt: '2026-09-01T08:00:00Z',
            keywords: { $seen: true }
          }),
          makeEmail({
            id: 't2',
            threadId: 'thread',
            receivedAt: '2026-09-01T09:00:00Z',
            keywords: {}
          }),
          makeEmail({ id: 'alone', receivedAt: '2026-09-01T07:00:00Z' })
        ]
      })
      const observer = new InfiniteQueryObserver(
        setup.queryClient,
        emailListSourceQueryOptions(setup.client, FAKE_ACCOUNT_ID, {
          kind: 'mailbox',
          mailboxId: INBOX,
          collapseThreads: true
        })
      )
      const unsubscribe = observer.subscribe(() => undefined)
      const key = threadKeys.threads(FAKE_ACCOUNT_ID, INBOX)
      await until(
        () =>
          (setup.queryClient.getQueryData<EmailListData>(key)?.pages.length ??
            0) > 0
      )
      await setup.queryClient.query(
        conversationQueryOptions(setup.client, FAKE_ACCOUNT_ID, 'thread', 't2')
      )
      const opened = await setup.queryClient.query(
        emailQueryOptions(setup.client, FAKE_ACCOUNT_ID, 't2')
      )
      if (opened === null) throw new Error('No email t2')
      await setup.queryClient.query(
        mailboxesQueryOptions(setup.client, FAKE_ACCOUNT_ID)
      )
      const { release, sent } = await sendOwnChangeHeld(setup, [
        opened,
        { ...opened, keywords: { $seen: true } }
      ])
      const before = setup.server.requests.length

      setup.sync.stateChanged(setup.server.states())
      release()
      await sent
      await setup.sync.whenIdle()

      const methods = methodsSince(setup, before).flat()
      expect(methods).not.toContain('Email/changes')
      expect(methods).toContain('Mailbox/changes')
      const page = setup.queryClient.getQueryData<EmailListData>(key)?.pages[0]
      expect(page?.state).toBe(setup.server.states().Email)
      expect(page?.threads?.thread?.map(member => member.keywords)).toEqual([
        { $seen: true },
        { $seen: true }
      ])
      expect(
        setup.queryClient.getQueryData<ConversationData>(
          conversationKeys.detail(FAKE_ACCOUNT_ID, 'thread')
        )?.state
      ).toBe(setup.server.states().Email)
      unsubscribe()
    })

    it('reads the changes when one made elsewhere comes while it waits', async () => {
      const setup = await makeSetup({ emails: makeEmails(3) })
      await loadInbox(setup, 1)
      const { release, sent } = await sendOwnChangeHeld(setup, readEmail('e1'))
      setup.server.updateEmail('e2', { keywords: { $flagged: true } })
      const before = setup.server.requests.length

      setup.sync.stateChanged(setup.server.states())
      release()
      await sent
      await setup.sync.whenIdle()

      expect(methodsSince(setup, before)).toEqual([
        ['Email/changes', 'Email/get', 'Email/get']
      ])
    })

    it('reads the changes when our own change is refused while it waits', async () => {
      const setup = await makeSetup({ emails: makeEmails(3) })
      await loadInbox(setup, 1)
      setup.server.setErrors.set('e1', 'forbidden')
      const release = setup.holdSetAnswers()
      const sent = changeOwnEmail(setup, ...readEmail('e1'))
      await until(() => setup.server.callsOf('Email/set').length === 1)
      // Something else changed meanwhile
      setup.server.updateEmail('e2', { keywords: { $flagged: true } })
      const before = setup.server.requests.length

      setup.sync.stateChanged(setup.server.states())
      release()
      await sent
      await setup.sync.whenIdle()

      expect(methodsSince(setup, before)).toEqual([
        ['Email/changes', 'Email/get', 'Email/get']
      ])
    })

    it('reads the changes once the answer is too late', async () => {
      jest.useFakeTimers({
        doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask']
      })
      try {
        const setup = await makeSetup({ emails: makeEmails(3) })
        await loadInbox(setup, 1)
        const own = ownStatesOf(setup.client, FAKE_ACCOUNT_ID)
        // An answer that never comes
        const settle = own.track('Email')
        setup.server.updateEmail('e1', { keywords: { $seen: true } })
        const before = setup.server.requests.length

        setup.sync.stateChanged(setup.server.states())
        expect(methodsSince(setup, before)).toEqual([])
        await jest.advanceTimersByTimeAsync(OWN_SET_WAIT_MS)
        await setup.sync.whenIdle()

        expect(methodsSince(setup, before)).toEqual([
          ['Email/changes', 'Email/get', 'Email/get']
        ])
        settle()
      } finally {
        jest.useRealTimers()
      }
    })

    it('reads the changes when the update could not show all of ours', async () => {
      const setup = await makeSetup({
        emails: [
          ...makeEmails(2),
          makeEmail({ id: 'archived', mailboxIds: { [ARCHIVE]: true } })
        ]
      })
      await loadInbox(setup, 1)
      const before = setup.server.requests.length

      // Not listed: the inbox cannot insert it alone
      await changeOwnEmail(
        setup,
        { id: 'archived', mailboxIds: { [ARCHIVE]: true }, keywords: {} },
        { id: 'archived', mailboxIds: { [INBOX]: true }, keywords: {} }
      )
      await pushNow(setup)

      expect(methodsSince(setup, before).slice(1)[0]).toContain('Email/changes')
      expect(listedIds(setup)).toContain('archived')
    })
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

  it('catches up its changes 128 at a time, as tmail-flutter', async () => {
    const setup = await makeSetup({ emails: makeEmails(300) })
    await loadInbox(setup, 1)

    // Read in another client while the tab was hidden
    for (const { id } of [...setup.server.emails]) {
      setup.server.updateEmail(id, { keywords: { $seen: true } })
    }
    await pushNow(setup)

    expect(
      setup.server.callsOf('Email/changes').map(args => args.maxChanges)
    ).toEqual([128, 128, 128])
    expect(
      inboxData(setup).pages[0]?.emails.every(
        email => email.keywords.$seen === true
      )
    ).toBe(true)
    const state = setup.queryClient.getQueryState(
      threadKeys.list(FAKE_ACCOUNT_ID, INBOX)
    )
    expect(state?.isInvalidated).toBe(false)
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

  it('follows the changes round after round, whatever their number', async () => {
    // 21 rounds of 128
    const setup = await makeSetup({ emails: makeEmails(20 * 128 + 1) })
    await loadInbox(setup, 1)

    for (const { id } of [...setup.server.emails]) {
      setup.server.updateEmail(id, { keywords: { $seen: true } })
    }
    await pushNow(setup)

    expect(setup.server.callsOf('Email/changes')).toHaveLength(21)
    const state = setup.queryClient.getQueryState(
      threadKeys.list(FAKE_ACCOUNT_ID, INBOX)
    )
    expect(state?.isInvalidated).toBe(false)
  })

  it('refetches the mailboxes when their changes do not move on', async () => {
    // The server says it has more, and reports none
    const setup = await makeSetup({ emails: makeEmails(3), maxChanges: 0 })
    await setup.queryClient.query(
      mailboxesQueryOptions(setup.client, FAKE_ACCOUNT_ID)
    )

    setup.server.updateMailbox(INBOX, { unreadEmails: 9 })
    await pushNow(setup)

    expect(setup.server.callsOf('Mailbox/changes')).toHaveLength(1)
    expect(
      setup.queryClient.getQueryState(['mailbox', FAKE_ACCOUNT_ID, 'list'])
        ?.isInvalidated
    ).toBe(true)
  })

  it('refetches the first page when the changes do not move on', async () => {
    // The server says it has more, and reports none
    const setup = await makeSetup({ emails: makeEmails(3), maxChanges: 0 })
    await loadInbox(setup, 1)

    setup.server.addEmail(
      makeEmail({ id: 'new', receivedAt: '2026-09-02T00:00:00Z' })
    )
    await pushNow(setup)

    const state = setup.queryClient.getQueryState(
      threadKeys.list(FAKE_ACCOUNT_ID, INBOX)
    )
    expect(state?.isInvalidated).toBe(true)
  })

  it('refetches the first page after MAX_CHANGES_ROUNDS of states reporting no change', async () => {
    const setup = await makeSetup({ emails: makeEmails(3) })
    await loadInbox(setup, 1)
    let round = 0
    // The server moves on, has more changes, and never reports any
    setup.server.handlers.set('Email/changes', args => {
      round += 1
      return {
        accountId: FAKE_ACCOUNT_ID,
        oldState: args.sinceState,
        newState: `state-email-elsewhere-${round}`,
        hasMoreChanges: true,
        created: [],
        updated: [],
        destroyed: []
      }
    })

    setup.sync.stateChanged({ Email: 'state-email-elsewhere-0' })
    await setup.sync.whenIdle()

    expect(round).toBe(MAX_CHANGES_ROUNDS)
    const state = setup.queryClient.getQueryState(
      threadKeys.list(FAKE_ACCOUNT_ID, INBOX)
    )
    expect(state?.isInvalidated).toBe(true)
  })

  it('refetches the mailboxes after MAX_CHANGES_ROUNDS of states reporting no change', async () => {
    const setup = await makeSetup()
    await setup.queryClient.query(
      mailboxesQueryOptions(setup.client, FAKE_ACCOUNT_ID)
    )
    let round = 0
    setup.server.handlers.set('Mailbox/changes', args => {
      round += 1
      return {
        accountId: FAKE_ACCOUNT_ID,
        oldState: args.sinceState,
        newState: `state-mailbox-elsewhere-${round}`,
        hasMoreChanges: true,
        created: [],
        updated: [],
        destroyed: []
      }
    })

    setup.sync.stateChanged({ Mailbox: 'state-mailbox-elsewhere-0' })
    await setup.sync.whenIdle()

    expect(round).toBe(MAX_CHANGES_ROUNDS)
    expect(
      setup.queryClient.getQueryState(['mailbox', FAKE_ACCOUNT_ID, 'list'])
        ?.isInvalidated
    ).toBe(true)
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

  describe('search results', () => {
    const REQUEST: SearchRequest = {
      filter: { text: 'report' },
      sort: [{ property: 'receivedAt', isAscending: false }]
    }

    function reports(): FakeEmail[] {
      return [
        makeEmail({
          id: 'r1',
          subject: 'First report',
          receivedAt: '2026-09-01T10:00:00Z'
        }),
        makeEmail({
          id: 'r2',
          subject: 'Second report',
          receivedAt: '2026-09-01T09:00:00Z'
        }),
        makeEmail({ id: 'other', subject: 'Lunch' })
      ]
    }

    function searchKey(): readonly unknown[] {
      return threadKeys.search(FAKE_ACCOUNT_ID, REQUEST)
    }

    function resultIds({ queryClient }: Setup): string[] {
      return (
        queryClient
          .getQueryData<EmailListData>(searchKey())
          ?.pages.flatMap(page => page.emails.map(email => email.id)) ?? []
      )
    }

    function observeSearch({ queryClient, client }: Setup): () => void {
      const observer = new InfiniteQueryObserver(
        queryClient,
        emailListSourceQueryOptions(client, FAKE_ACCOUNT_ID, {
          kind: 'search',
          request: REQUEST
        })
      )
      return observer.subscribe(() => undefined)
    }

    it('patches the listed results in place, archived ones included', async () => {
      const setup = await makeSetup({ emails: reports() })
      const unsubscribe = observeSearch(setup)
      await until(() => resultIds(setup).length === 2)
      const before = setup.server.requests.length

      setup.server.updateEmail('r2', {
        keywords: { $seen: true },
        mailboxIds: { [ARCHIVE]: true }
      })
      await pushNow(setup)

      expect(resultIds(setup)).toEqual(['r1', 'r2'])
      const r2 = setup.queryClient
        .getQueryData<EmailListData>(searchKey())
        ?.pages[0]?.emails.find(email => email.id === 'r2')
      expect(r2?.mailboxIds).toEqual({ [ARCHIVE]: true })
      expect(methodsSince(setup, before)).toEqual([
        ['Email/changes', 'Email/get', 'Email/get']
      ])
      unsubscribe()
    })

    it('queries the shown results again when an unlisted email changed', async () => {
      const setup = await makeSetup({ emails: reports() })
      const unsubscribe = observeSearch(setup)
      await until(() => resultIds(setup).length === 2)
      const before = setup.server.requests.length

      setup.server.addEmail(
        makeEmail({
          id: 'r0',
          subject: 'Newest report',
          receivedAt: '2026-09-02T10:00:00Z'
        })
      )
      await pushNow(setup)

      expect(resultIds(setup)).toEqual(['r0', 'r1', 'r2'])
      expect(methodsSince(setup, before)).toEqual([
        ['Email/changes', 'Email/get', 'Email/get'],
        ['Email/query'],
        ['Email/get'],
        ['SearchSnippet/get']
      ])
      unsubscribe()
    })

    it('queries nothing for an unlisted email that cannot match the search', async () => {
      const setup = await makeSetup({ emails: reports() })
      const request: SearchRequest = {
        ...REQUEST,
        filter: { text: 'report', inMailboxOtherThan: ['mailbox-trash'] }
      }
      const observer = new InfiniteQueryObserver(
        setup.queryClient,
        emailListSourceQueryOptions(setup.client, FAKE_ACCOUNT_ID, {
          kind: 'search',
          request
        })
      )
      const unsubscribe = observer.subscribe(() => undefined)
      await until(() => observer.getCurrentResult().data !== undefined)
      const before = setup.server.requests.length

      setup.server.addEmail(
        makeEmail({
          id: 'trashed',
          subject: 'Old report',
          mailboxIds: { 'mailbox-trash': true }
        })
      )
      await pushNow(setup)

      expect(methodsSince(setup, before)).toEqual([
        ['Email/changes', 'Email/get', 'Email/get']
      ])
      unsubscribe()
    })

    it('queries more than 256 shown results again by chunks, keeping them', async () => {
      const many = Array.from({ length: 300 }, (_, index) =>
        makeEmail({
          id: `r${index}`,
          subject: `Report ${index}`,
          receivedAt: new Date(Date.UTC(2026, 8, 1) - index * 60_000)
            .toISOString()
            .replace(/\.\d{3}Z$/, 'Z')
        })
      )
      const setup = await makeSetup({ emails: many })
      const options = emailListSourceQueryOptions(
        setup.client,
        FAKE_ACCOUNT_ID,
        { kind: 'search', request: REQUEST }
      )
      await setup.queryClient.infiniteQuery({ ...options, pages: 10 })
      const unsubscribe = observeSearch(setup)
      expect(resultIds(setup)).toHaveLength(300)
      const before = setup.server.requests.length

      setup.server.addEmail(
        makeEmail({
          id: 'newest',
          subject: 'Newest report',
          receivedAt: '2026-09-02T10:00:00Z'
        })
      )
      await pushNow(setup)

      expect(methodsSince(setup, before)).toEqual([
        ['Email/changes', 'Email/get', 'Email/get'],
        ['Email/query', 'Email/query'],
        ['Email/get'],
        ['SearchSnippet/get']
      ])
      // The window keeps its size: the oldest comes with the next page
      const ids = resultIds(setup)
      expect(ids).toHaveLength(300)
      expect(ids.slice(0, 2)).toEqual(['newest', 'r0'])
      expect(ids[299]).toBe('r298')
      unsubscribe()
    })

    it('starts over the results no screen shows', async () => {
      const setup = await makeSetup({ emails: reports() })
      await setup.queryClient.infiniteQuery(
        emailListSourceQueryOptions(setup.client, FAKE_ACCOUNT_ID, {
          kind: 'search',
          request: REQUEST
        })
      )
      const before = setup.server.requests.length

      setup.server.addEmail(makeEmail({ id: 'r0', subject: 'New report' }))
      await pushNow(setup)

      expect(methodsSince(setup, before)).toEqual([
        ['Email/changes', 'Email/get', 'Email/get']
      ])
      expect(setup.queryClient.getQueryState(searchKey())?.isInvalidated).toBe(
        true
      )
    })
  })

  describe('conversations', () => {
    function threadEmails(): FakeEmail[] {
      return [
        makeEmail({
          id: 't1',
          threadId: 'thread',
          receivedAt: '2026-09-01T08:00:00Z'
        }),
        makeEmail({
          id: 't2',
          threadId: 'thread',
          receivedAt: '2026-09-01T09:00:00Z'
        }),
        makeEmail({ id: 'alone', receivedAt: '2026-09-01T07:00:00Z' })
      ]
    }

    it('adds a reply to an open conversation', async () => {
      const setup = await makeSetup({ emails: threadEmails() })
      await setup.queryClient.query(
        conversationQueryOptions(setup.client, FAKE_ACCOUNT_ID, 'thread', 't1')
      )

      setup.server.addEmail(
        makeEmail({
          id: 't3',
          threadId: 'thread',
          receivedAt: '2026-09-01T10:00:00Z'
        })
      )
      await pushNow(setup)

      expect(
        setup.queryClient
          .getQueryData<ConversationData>(
            conversationKeys.detail(FAKE_ACCOUNT_ID, 'thread')
          )
          ?.emails.map(email => email.id)
      ).toEqual(['t1', 't2', 't3'])
    })

    it('shows the newest email of a conversation in a list of conversations', async () => {
      const setup = await makeSetup({ emails: threadEmails() })
      const observer = new InfiniteQueryObserver(
        setup.queryClient,
        emailListSourceQueryOptions(setup.client, FAKE_ACCOUNT_ID, {
          kind: 'mailbox',
          mailboxId: INBOX,
          collapseThreads: true
        })
      )
      const unsubscribe = observer.subscribe(() => undefined)
      const key = threadKeys.threads(FAKE_ACCOUNT_ID, INBOX)
      const rows = (): string[] =>
        setup.queryClient
          .getQueryData<EmailListData>(key)
          ?.pages.flatMap(page => page.emails.map(email => email.id)) ?? []
      await until(() => rows().length === 2)
      const sizes = (): Record<string, number> =>
        Object.fromEntries(
          Object.entries(
            setup.queryClient.getQueryData<EmailListData>(key)?.pages[0]
              ?.threads ?? {}
          ).map(([threadId, members]) => [threadId, members.length])
        )
      expect(sizes()).toEqual({ thread: 2, 'thread-alone': 1 })

      setup.server.addEmail(
        makeEmail({
          id: 't3',
          threadId: 'thread',
          receivedAt: '2026-09-01T10:00:00Z'
        })
      )
      await pushNow(setup)

      expect(rows()).toEqual(['t3', 'alone'])
      expect(sizes()).toEqual({ thread: 3, 'thread-alone': 1 })
      unsubscribe()
    })

    it('moves a conversation up on a reply without querying the list again', async () => {
      const setup = await makeSetup({ emails: threadEmails() })
      const observer = new InfiniteQueryObserver(
        setup.queryClient,
        emailListSourceQueryOptions(setup.client, FAKE_ACCOUNT_ID, {
          kind: 'mailbox',
          mailboxId: INBOX,
          collapseThreads: true
        })
      )
      const unsubscribe = observer.subscribe(() => undefined)
      const key = threadKeys.threads(FAKE_ACCOUNT_ID, INBOX)
      const rows = (): string[] =>
        setup.queryClient
          .getQueryData<EmailListData>(key)
          ?.pages.flatMap(page => page.emails.map(email => email.id)) ?? []
      await until(() => rows().length === 2)
      const before = setup.server.calledMethods().length

      setup.server.addEmail(
        makeEmail({
          id: 'alone-reply',
          threadId: 'thread-alone',
          receivedAt: '2026-09-02T10:00:00Z'
        })
      )
      await pushNow(setup)

      expect(rows()).toEqual(['alone-reply', 't2'])
      const methods = setup.server.calledMethods().slice(before)
      expect(methods).not.toContain('Email/query')
      expect(methods).not.toContain('Thread/get')
      unsubscribe()
    })

    it('brings in a new conversation with its thread, then its members', async () => {
      const setup = await makeSetup({ emails: threadEmails() })
      const observer = new InfiniteQueryObserver(
        setup.queryClient,
        emailListSourceQueryOptions(setup.client, FAKE_ACCOUNT_ID, {
          kind: 'mailbox',
          mailboxId: INBOX,
          collapseThreads: true
        })
      )
      const unsubscribe = observer.subscribe(() => undefined)
      const key = threadKeys.threads(FAKE_ACCOUNT_ID, INBOX)
      const rows = (): string[] =>
        setup.queryClient
          .getQueryData<EmailListData>(key)
          ?.pages.flatMap(page => page.emails.map(email => email.id)) ?? []
      await until(() => rows().length === 2)
      const before = setup.server.requests.length

      setup.server.addEmail(
        makeEmail({ id: 'new', receivedAt: '2026-09-03T10:00:00Z' })
      )
      await pushNow(setup)

      expect(rows()).toEqual(['new', 't2', 'alone'])
      const requests = setup.server.requests.slice(before)
      expect(
        requests.map(request => request.methodCalls.map(([name]) => name))
      ).toEqual([
        ['Email/changes', 'Email/get', 'Email/get'],
        ['Thread/get'],
        ['Email/get'],
        ['Email/get']
      ])
      unsubscribe()
    })
  })
})
