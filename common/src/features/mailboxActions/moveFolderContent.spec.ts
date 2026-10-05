import { createClient, type JmapClient } from 'jmap-client-ts'
import { LINAGORA_METHOD_CAPABILITIES } from 'jmap-client-ts/linagora'

import {
  FAKE_ACCOUNT_ID,
  FAKE_SESSION_URL,
  makeEmail,
  makeFakeJmapServer,
  makeMailbox,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'

import { moveFolderContent, undoMoveFolderContent } from './moveFolderContent'

function makeClient(server: FakeJmapServer): JmapClient {
  return createClient({
    sessionUrl: FAKE_SESSION_URL,
    fetch: server.fetch,
    methodCapabilities: LINAGORA_METHOD_CAPABILITIES
  })
}

function makeServer(count: number): FakeJmapServer {
  return makeFakeJmapServer({
    mailboxes: [
      makeMailbox({ id: 'from', name: 'From' }),
      makeMailbox({ id: 'to', name: 'To' }),
      makeMailbox({ id: 'spam', name: 'Spam', role: 'junk' })
    ],
    emails: Array.from({ length: count }, (_, index) =>
      makeEmail({
        id: `e${index}`,
        mailboxIds: { from: true },
        receivedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString()
      })
    )
  })
}

function inMailbox(server: FakeJmapServer, mailboxId: string): string[] {
  return server.emails
    .filter(email => mailboxId in email.mailboxIds)
    .map(email => email.id)
}

describe('moveFolderContent', () => {
  it('moves every email, a batch at a time, and reports the progress', async () => {
    const server = makeServer(7)
    const progress: number[] = []

    const result = await moveFolderContent(
      makeClient(server),
      FAKE_ACCOUNT_ID,
      'from',
      'to',
      { batchSize: 3, onProgress: moved => progress.push(moved) }
    )

    expect(result.error).toBeNull()
    expect(result.failedCount).toBe(0)
    expect(result.movedIds).toHaveLength(7)
    expect(progress).toEqual([3, 6, 7])
    expect(inMailbox(server, 'from')).toEqual([])
    expect(inMailbox(server, 'to')).toHaveLength(7)
    const sets = server.requests.filter(request =>
      request.methodCalls.some(([name]) => name === 'Email/set')
    )
    expect(sets).toHaveLength(3)
  })

  it('does nothing for an empty folder', async () => {
    const server = makeServer(0)

    const result = await moveFolderContent(
      makeClient(server),
      FAKE_ACCOUNT_ID,
      'from',
      'to',
      { batchSize: 50 }
    )

    expect(result).toEqual({ movedIds: [], failedCount: 0, error: null })
  })

  it('marks the emails read when they go to Spam', async () => {
    const server = makeServer(2)

    await moveFolderContent(
      makeClient(server),
      FAKE_ACCOUNT_ID,
      'from',
      'spam',
      { batchSize: 50, markSeen: true }
    )

    expect(server.emails.every(email => email.keywords.$seen === true)).toBe(
      true
    )
  })

  it('leaves the emails the server refuses, counts them and goes on', async () => {
    const server = makeServer(5)
    server.setErrors.set('e4', 'forbidden')

    const result = await moveFolderContent(
      makeClient(server),
      FAKE_ACCOUNT_ID,
      'from',
      'to',
      { batchSize: 2 }
    )

    expect(result.failedCount).toBe(1)
    expect(result.movedIds).toHaveLength(4)
    expect(inMailbox(server, 'from')).toEqual(['e4'])
  })

  it('reports the request that fails, with what moved before', async () => {
    const server = makeServer(4)
    let calls = 0
    const original = server.fetch
    server.fetch = async (input, init) => {
      if (
        typeof init?.body === 'string' &&
        init.body.includes('Email/set') &&
        ++calls === 2
      ) {
        throw new Error('offline')
      }
      return original(input, init)
    }

    const result = await moveFolderContent(
      createClient({
        sessionUrl: FAKE_SESSION_URL,
        fetch: server.fetch,
        methodCapabilities: LINAGORA_METHOD_CAPABILITIES
      }),
      FAKE_ACCOUNT_ID,
      'from',
      'to',
      { batchSize: 2 }
    )

    expect(result.movedIds).toHaveLength(2)
    expect(result.error).toBeInstanceOf(Error)
  })
})

describe('undoMoveFolderContent', () => {
  it('puts back only the emails that moved', async () => {
    const server = makeServer(3)
    server.emails.push(makeEmail({ id: 'already', mailboxIds: { to: true } }))
    const client = makeClient(server)
    const { movedIds } = await moveFolderContent(
      client,
      FAKE_ACCOUNT_ID,
      'from',
      'to',
      { batchSize: 2 }
    )

    const isUndone = await undoMoveFolderContent(
      client,
      FAKE_ACCOUNT_ID,
      movedIds,
      'from',
      'to',
      { batchSize: 2 }
    )

    expect(isUndone).toBe(true)
    expect(inMailbox(server, 'from').sort()).toEqual(['e0', 'e1', 'e2'])
    expect(inMailbox(server, 'to')).toEqual(['already'])
  })
})
