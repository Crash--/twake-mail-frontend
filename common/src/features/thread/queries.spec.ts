import { QueryClient } from '@tanstack/react-query'
import { createClient, type JmapClient } from '@linagora/jmap-client-ts'
import { METHOD_CAPABILITIES } from '@common/jmap/methodCapabilities'

import {
  FAKE_ACCOUNT_ID,
  FAKE_SESSION_URL,
  makeEmail,
  makeFakeJmapServer,
  type FakeEmail,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { answerQueriesFromStaleIndex } from '@common/testing/staleIndex'

import { fetchThreadUpdates } from './fetchThreadUpdates'
import {
  conversationQueryOptions,
  EMAIL_LIST_PAGE_SIZE,
  fetchEmailListPage,
  fetchListPage,
  getNextPosition,
  listedTotal,
  MAILBOX_SORT,
  type EmailListPage,
  type ListPageOptions,
  type SearchRequest
} from './queries'
import { refreshQueryList } from './refreshQueryList'

const MAX_OBJECTS_IN_GET = 50

function makeClient(server: FakeJmapServer): JmapClient {
  return createClient({
    sessionUrl: FAKE_SESSION_URL,
    fetch: server.fetch,
    methodCapabilities: METHOD_CAPABILITIES
  })
}

/** A thread longer than `maxObjectsInGet`, the oldest first */
function makeLongThread(): FakeEmail[] {
  return Array.from({ length: MAX_OBJECTS_IN_GET + 10 }, (_, index) =>
    makeEmail({
      id: `m${index}`,
      threadId: 'long',
      receivedAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString()
    })
  )
}

describe('a thread longer than maxObjectsInGet', () => {
  it('opens as a conversation of all its emails', async () => {
    const emails = makeLongThread()
    const server = makeFakeJmapServer({
      emails,
      maxObjectsInGet: MAX_OBJECTS_IN_GET
    })

    const data = await new QueryClient().query(
      conversationQueryOptions(
        makeClient(server),
        FAKE_ACCOUNT_ID,
        'long',
        'm0'
      )
    )

    expect(data.emails.map(email => email.id)).toEqual(
      emails.map(email => email.id)
    )
  })

  it('lists all its members in a list of conversations', async () => {
    const server = makeFakeJmapServer({
      emails: makeLongThread(),
      maxObjectsInGet: MAX_OBJECTS_IN_GET
    })

    const page = await fetchEmailListPage(
      makeClient(server),
      FAKE_ACCOUNT_ID,
      'mailbox-inbox',
      0,
      new AbortController().signal,
      true
    )

    expect(page.threads?.long).toHaveLength(MAX_OBJECTS_IN_GET + 10)
  })

  it('brings all its members and rows to the lists push patches', async () => {
    const emails = makeLongThread()
    const server = makeFakeJmapServer({
      emails,
      maxObjectsInGet: MAX_OBJECTS_IN_GET
    })

    const updates = await fetchThreadUpdates(
      makeClient(server),
      FAKE_ACCOUNT_ID,
      { threadIds: ['long'], rowIds: emails.map(email => email.id) }
    )

    expect(updates.threads.get('long')).toHaveLength(MAX_OBJECTS_IN_GET + 10)
    expect(updates.rows.size).toBe(MAX_OBJECTS_IN_GET + 10)
  })

  it('brings all its members to a list of conversations queried again', async () => {
    const server = makeFakeJmapServer({
      emails: [makeEmail({ id: 'old', receivedAt: '2026-08-01T00:00:00Z' })],
      maxObjectsInGet: MAX_OBJECTS_IN_GET
    })
    const client = makeClient(server)
    const request: SearchRequest = {
      filter: { inMailbox: 'mailbox-inbox' },
      sort: MAILBOX_SORT,
      collapseThreads: true
    }
    const page = await fetchListPage(client, FAKE_ACCOUNT_ID, request, {
      position: 0,
      limit: EMAIL_LIST_PAGE_SIZE,
      withSnippets: false
    })
    for (const email of makeLongThread()) server.addEmail(email)

    const refreshed = await refreshQueryList(client, FAKE_ACCOUNT_ID, request, {
      pages: [page],
      pageParams: [0]
    })

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- false positive of Rslint (web-infra-dev/rslint#2625)
    expect(refreshed?.pages[0]?.threads?.long).toHaveLength(
      MAX_OBJECTS_IN_GET + 10
    )
  })
})

describe('refreshQueryList', () => {
  it('reads the members of a conversation a new reply brings up', async () => {
    const server = makeFakeJmapServer({
      emails: [
        makeEmail({
          id: 'first',
          threadId: 'plan',
          receivedAt: '2026-08-01T00:00:00Z'
        })
      ]
    })
    const client = makeClient(server)
    const request: SearchRequest = {
      filter: { inMailbox: 'mailbox-inbox' },
      sort: MAILBOX_SORT,
      collapseThreads: true
    }
    const page = await fetchListPage(client, FAKE_ACCOUNT_ID, request, {
      position: 0,
      limit: EMAIL_LIST_PAGE_SIZE,
      withSnippets: false
    })
    server.addEmail(
      makeEmail({
        id: 'reply',
        threadId: 'plan',
        receivedAt: '2026-08-02T00:00:00Z'
      })
    )

    const refreshed = await refreshQueryList(client, FAKE_ACCOUNT_ID, request, {
      pages: [page],
      pageParams: [0]
    })

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- false positive of Rslint (web-infra-dev/rslint#2625)
    expect(refreshed?.pages[0]?.emails.map(email => email.id)).toEqual([
      'reply'
    ])
    expect(
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- false positive of Rslint (web-infra-dev/rslint#2625)
      refreshed?.pages[0]?.threads?.plan?.map(member => member.id)
    ).toEqual(['first', 'reply'])
  })
})

describe('more threads than maxObjectsInGet', () => {
  it('brings the members of each thread to the lists push patches', async () => {
    const emails = Array.from({ length: MAX_OBJECTS_IN_GET + 10 }, (_, index) =>
      makeEmail({ id: `m${index}`, threadId: `t${index}` })
    )
    const server = makeFakeJmapServer({
      emails,
      maxObjectsInGet: MAX_OBJECTS_IN_GET
    })

    const updates = await fetchThreadUpdates(
      makeClient(server),
      FAKE_ACCOUNT_ID,
      { threadIds: emails.map(email => email.threadId), rowIds: [] }
    )

    expect(
      [...updates.threads.values()].every(members => members.length === 1)
    ).toBe(true)
    expect(updates.threads.size).toBe(MAX_OBJECTS_IN_GET + 10)
  })
})

describe('more new emails than maxObjectsInGet in a list queried again', () => {
  it('brings them all, with the members of their conversations', async () => {
    const server = makeFakeJmapServer({ maxObjectsInGet: 10 })
    const client = makeClient(server)
    const request: SearchRequest = {
      filter: { inMailbox: 'mailbox-inbox' },
      sort: MAILBOX_SORT,
      collapseThreads: true
    }
    const page = await fetchListPage(client, FAKE_ACCOUNT_ID, request, {
      position: 0,
      limit: EMAIL_LIST_PAGE_SIZE,
      withSnippets: false
    })
    for (let index = 0; index < 20; index++) {
      server.addEmail(
        makeEmail({
          id: `n${index}`,
          receivedAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString()
        })
      )
    }

    const refreshed = await refreshQueryList(client, FAKE_ACCOUNT_ID, request, {
      pages: [page],
      pageParams: [0]
    })

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- false positive of Rslint (web-infra-dev/rslint#2625)
    expect(refreshed?.pages[0]?.emails).toHaveLength(20)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- false positive of Rslint (web-infra-dev/rslint#2625)
    expect(Object.keys(refreshed?.pages[0]?.threads ?? {})).toHaveLength(20)
  })

  it('keeps the snippets of all the new results of a search', async () => {
    const server = makeFakeJmapServer({ maxObjectsInGet: 10 })
    const client = makeClient(server)
    const request: SearchRequest = {
      filter: { text: 'report' },
      sort: MAILBOX_SORT
    }
    const page = await fetchListPage(client, FAKE_ACCOUNT_ID, request, {
      position: 0,
      limit: EMAIL_LIST_PAGE_SIZE,
      withSnippets: true
    })
    for (let index = 0; index < 20; index++) {
      server.addEmail(
        makeEmail({
          id: `n${index}`,
          subject: `Report ${index}`,
          receivedAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString()
        })
      )
    }

    const refreshed = await refreshQueryList(client, FAKE_ACCOUNT_ID, request, {
      pages: [page],
      pageParams: [0]
    })

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- false positive of Rslint (web-infra-dev/rslint#2625)
    expect(Object.keys(refreshed?.pages[0]?.snippets ?? {})).toHaveLength(20)
  })
})

describe('a search index behind the emails', () => {
  const UNREAD_INBOX: SearchRequest = {
    filter: {
      operator: 'AND',
      conditions: [{ inMailbox: 'mailbox-inbox' }, { notKeyword: '$seen' }]
    },
    sort: MAILBOX_SORT,
    isListFiltered: true
  }

  /** `count` emails, the most recent first, unread as the index knows them */
  function makeUnreadEmails(count: number): FakeEmail[] {
    return Array.from({ length: count }, (_, index) =>
      makeEmail({
        id: `e${index}`,
        receivedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, count - index))
          .toISOString()
          .replace('.000', '')
      })
    )
  }

  function markRead(email: FakeEmail): FakeEmail {
    return { ...email, keywords: { $seen: true } }
  }

  /** A server whose emails `readIds` were read after the index saw them */
  function makeStaleServer(
    indexed: readonly FakeEmail[],
    readIds: readonly string[]
  ): FakeJmapServer {
    const server = makeFakeJmapServer({
      emails: indexed.map(email =>
        readIds.includes(email.id) ? markRead(email) : email
      )
    })
    answerQueriesFromStaleIndex(server, indexed)
    return server
  }

  function firstPageAt(position: number): ListPageOptions {
    return { position, limit: EMAIL_LIST_PAGE_SIZE, withSnippets: false }
  }

  it('does not list the emails Email/get tells no longer match', async () => {
    const server = makeStaleServer(makeUnreadEmails(3), ['e1'])

    const page = await fetchListPage(
      makeClient(server),
      FAKE_ACCOUNT_ID,
      UNREAD_INBOX,
      firstPageAt(0)
    )

    expect(page.emails.map(email => email.id)).toEqual(['e0', 'e2'])
    expect(page.count).toBe(3)
  })

  it('pages after the emails it does not list', async () => {
    const indexed = makeUnreadEmails(EMAIL_LIST_PAGE_SIZE + 5)
    const server = makeStaleServer(
      indexed,
      indexed.slice(0, EMAIL_LIST_PAGE_SIZE).map(email => email.id)
    )
    const client = makeClient(server)

    const first = await fetchListPage(
      client,
      FAKE_ACCOUNT_ID,
      UNREAD_INBOX,
      firstPageAt(0)
    )
    const nextPosition = getNextPosition(first)
    const second = await fetchListPage(
      client,
      FAKE_ACCOUNT_ID,
      UNREAD_INBOX,
      firstPageAt(nextPosition ?? -1)
    )

    expect(first.emails).toEqual([])
    expect(first.isLast).toBe(false)
    expect(nextPosition).toBe(EMAIL_LIST_PAGE_SIZE)
    expect(second.emails.map(email => email.id)).toEqual([
      'e30',
      'e31',
      'e32',
      'e33',
      'e34'
    ])
    expect(second.isLast).toBe(true)
  })

  it('keeps a conversation one email of which still matches', async () => {
    const indexed = [
      makeEmail({
        id: 'reply',
        threadId: 'plan',
        receivedAt: '2026-08-02T00:00:00Z'
      }),
      makeEmail({
        id: 'first',
        threadId: 'plan',
        receivedAt: '2026-08-01T00:00:00Z'
      }),
      makeEmail({ id: 'other', receivedAt: '2026-07-01T00:00:00Z' })
    ]
    const server = makeStaleServer(indexed, ['reply', 'other'])

    const page = await fetchListPage(
      makeClient(server),
      FAKE_ACCOUNT_ID,
      { ...UNREAD_INBOX, collapseThreads: true },
      firstPageAt(0)
    )

    expect(page.emails.map(email => email.id)).toEqual(['reply'])
    expect(Object.keys(page.threads ?? {})).toEqual(['plan'])
    expect(page.count).toBe(2)
  })

  it('does not bring them when the list is queried again', async () => {
    const server = makeStaleServer([], [])
    const client = makeClient(server)
    const page = await fetchListPage(
      client,
      FAKE_ACCOUNT_ID,
      UNREAD_INBOX,
      firstPageAt(0)
    )
    const indexed = makeUnreadEmails(3)
    for (const email of indexed) {
      server.addEmail(email.id === 'e1' ? markRead(email) : email)
    }
    answerQueriesFromStaleIndex(server, indexed)

    const refreshed = await refreshQueryList(
      client,
      FAKE_ACCOUNT_ID,
      UNREAD_INBOX,
      { pages: [page], pageParams: [0] }
    )

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- false positive of Rslint (web-infra-dev/rslint#2625)
    expect(refreshed?.pages[0]?.emails.map(email => email.id)).toEqual([
      'e0',
      'e2'
    ])
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- false positive of Rslint (web-infra-dev/rslint#2625)
    expect(refreshed?.pages[0]?.count).toBe(3)
  })
})

describe('the members of the listed conversations', () => {
  function makeConversation(): FakeEmail[] {
    return [
      makeEmail({
        id: 'first',
        threadId: 'plan',
        receivedAt: '2026-08-01T00:00:00Z'
      }),
      makeEmail({
        id: 'reply',
        threadId: 'plan',
        receivedAt: '2026-08-02T00:00:00Z'
      })
    ]
  }

  it('come in the request of the page', async () => {
    const server = makeFakeJmapServer({ emails: makeConversation() })

    const page = await fetchEmailListPage(
      makeClient(server),
      FAKE_ACCOUNT_ID,
      'mailbox-inbox',
      0,
      new AbortController().signal,
      true
    )

    expect(page.threads?.plan?.map(member => member.id)).toEqual([
      'first',
      'reply'
    ])
    expect(server.requests).toHaveLength(1)
  })

  it('cost no request on an empty page', async () => {
    const server = makeFakeJmapServer()

    await fetchEmailListPage(
      makeClient(server),
      FAKE_ACCOUNT_ID,
      'mailbox-inbox',
      0,
      new AbortController().signal,
      true
    )

    expect(server.requests).toHaveLength(1)
  })

  it('come in the request of an opened conversation', async () => {
    const server = makeFakeJmapServer({ emails: makeConversation() })

    const data = await new QueryClient().query(
      conversationQueryOptions(
        makeClient(server),
        FAKE_ACCOUNT_ID,
        'plan',
        'reply'
      )
    )

    expect(data.emails.map(email => email.id)).toEqual(['first', 'reply'])
    expect(server.requests).toHaveLength(1)
  })
})

describe('listedTotal', () => {
  function page(
    count: number,
    listed: number,
    total: number | null
  ): EmailListPage {
    return {
      emails: Array.from({ length: listed }, (_, index) =>
        makeEmail({ id: `e${index}` })
      ),
      position: 0,
      count,
      total,
      isLast: false,
      state: 's1'
    }
  }

  it('leaves out of the total the results the loaded pages do not list', () => {
    expect(listedTotal([page(30, 0, 32), page(2, 2, 32)])).toBe(2)
  })

  it('is the server total when every result is listed', () => {
    expect(listedTotal([page(30, 30, 100)])).toBe(100)
  })

  it('is unknown without a page or a server total', () => {
    expect(listedTotal([])).toBe(null)
    expect(listedTotal([page(3, 1, null)])).toBe(null)
  })
})
