import { QueryClient } from '@tanstack/react-query'
import { createClient, type JmapClient } from 'jmap-client-ts'
import { LINAGORA_METHOD_CAPABILITIES } from 'jmap-client-ts/linagora'

import {
  FAKE_ACCOUNT_ID,
  FAKE_SESSION_URL,
  makeEmail,
  makeFakeJmapServer,
  type FakeEmail,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'

import { fetchThreadUpdates } from './fetchThreadUpdates'
import {
  conversationQueryOptions,
  EMAIL_LIST_PAGE_SIZE,
  fetchEmailListPage,
  fetchListPage,
  MAILBOX_SORT,
  type SearchRequest
} from './queries'
import { refreshQueryList } from './refreshQueryList'

const MAX_OBJECTS_IN_GET = 50

function makeClient(server: FakeJmapServer): JmapClient {
  return createClient({
    sessionUrl: FAKE_SESSION_URL,
    fetch: server.fetch,
    methodCapabilities: LINAGORA_METHOD_CAPABILITIES
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

    expect(refreshed?.pages[0]?.emails.map(email => email.id)).toEqual([
      'reply'
    ])
    expect(
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
