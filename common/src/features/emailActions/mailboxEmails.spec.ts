import { createClient, type JmapClient } from 'jmap-client-ts'
import { LINAGORA_METHOD_CAPABILITIES } from 'jmap-client-ts/linagora'

import {
  FAKE_ACCOUNT_ID,
  FAKE_SESSION_URL,
  makeEmail,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'

import {
  destroyMailboxEmails,
  fetchMailboxEmails,
  MAILBOX_PAGE_SIZE
} from './mailboxEmails'

function makeClient(server: FakeJmapServer): JmapClient {
  return createClient({
    sessionUrl: FAKE_SESSION_URL,
    fetch: server.fetch,
    methodCapabilities: LINAGORA_METHOD_CAPABILITIES
  })
}

function makeEmails(count: number): ReturnType<typeof makeEmail>[] {
  return Array.from({ length: count }, (_, index) =>
    makeEmail({
      id: `e${index}`,
      keywords: index % 2 === 0 ? { $seen: true } : {},
      receivedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString()
    })
  )
}

describe('fetchMailboxEmails', () => {
  it('goes through every page, with the query and the get in one request', async () => {
    const count = MAILBOX_PAGE_SIZE + 10
    const server = makeFakeJmapServer({ emails: makeEmails(count) })
    const client = makeClient(server)

    const emails = await fetchMailboxEmails(
      client,
      FAKE_ACCOUNT_ID,
      'mailbox-inbox'
    )

    expect(emails).toHaveLength(count)
    expect(emails[0]).toEqual({
      id: `e${count - 1}`,
      mailboxIds: { 'mailbox-inbox': true },
      keywords: {}
    })
    expect(
      server.requests.map(request => request.methodCalls.map(([name]) => name))
    ).toEqual([
      ['Email/query', 'Email/get'],
      ['Email/query', 'Email/get']
    ])
  })

  it('keeps the conditions given, e.g. the unread emails', async () => {
    const server = makeFakeJmapServer({ emails: makeEmails(6) })
    const client = makeClient(server)

    const emails = await fetchMailboxEmails(
      client,
      FAKE_ACCOUNT_ID,
      'mailbox-inbox',
      {
        filter: { notKeyword: '$seen' }
      }
    )

    expect(emails.map(email => email.id).sort()).toEqual(['e1', 'e3', 'e5'])
  })
})

describe('destroyMailboxEmails', () => {
  it('destroys a page at a time through a back-reference to the query', async () => {
    const server = makeFakeJmapServer({ emails: makeEmails(5) })
    const client = makeClient(server)

    const count = await destroyMailboxEmails(
      client,
      FAKE_ACCOUNT_ID,
      'mailbox-inbox',
      {
        batchSize: 2
      }
    )

    expect(count).toBe(5)
    expect(server.emails).toEqual([])
    const [first] = server.requests
    expect(first?.methodCalls[1]?.[1]).toEqual({
      accountId: FAKE_ACCOUNT_ID,
      '#destroy': expect.objectContaining({ name: 'Email/query', path: '/ids' })
    })
  })

  it('stops when the server refuses to destroy', async () => {
    const server = makeFakeJmapServer({ emails: makeEmails(2) })
    server.setErrors.set('e0', 'forbidden')
    server.setErrors.set('e1', 'forbidden')
    const client = makeClient(server)

    const count = await destroyMailboxEmails(
      client,
      FAKE_ACCOUNT_ID,
      'mailbox-inbox',
      {
        batchSize: 50
      }
    )

    expect(count).toBe(0)
    expect(server.requests).toHaveLength(1)
  })
})
