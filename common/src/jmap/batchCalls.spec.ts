import {
  createClient,
  JmapMethodError,
  type JmapClient
} from '@linagora/jmap-client-ts'
import { METHOD_CAPABILITIES } from '@common/jmap/methodCapabilities'

import {
  FAKE_ACCOUNT_ID,
  FAKE_SESSION_URL,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'

import { isBatchedMethod, withBatchedCalls } from './batchCalls'

function makeClient(server: FakeJmapServer, maxCalls = 16): JmapClient {
  return withBatchedCalls(
    createClient({
      sessionUrl: FAKE_SESSION_URL,
      fetch: server.fetch,
      methodCapabilities: METHOD_CAPABILITIES
    }),
    { maxCalls }
  )
}

/** The methods of each request received, a list per request */
function methodsPerRequest(server: FakeJmapServer): string[][] {
  return server.requests.map(request =>
    request.methodCalls.map(([name]) => name)
  )
}

describe('isBatchedMethod', () => {
  it.each([
    'Mailbox/get',
    'Email/query',
    'Email/changes',
    'Email/queryChanges',
    'TMailContact/autocomplete'
  ])('batches the read %s', method => {
    expect(isBatchedMethod(method)).toBe(true)
  })

  it.each([
    'Email/set',
    'Email/import',
    'Mailbox/clear',
    'EmailSubmission/set'
  ])('sends the write %s alone', method => {
    expect(isBatchedMethod(method)).toBe(false)
  })
})

describe('withBatchedCalls', () => {
  it('sends the calls made together in one request, each caller getting its answer', async () => {
    const server = makeFakeJmapServer()
    const client = makeClient(server)
    await client.getSession()

    const [mailboxes, identities] = await Promise.all([
      client.call('Mailbox/get', { accountId: FAKE_ACCOUNT_ID, ids: null }),
      client.call('Identity/get', { accountId: FAKE_ACCOUNT_ID, ids: null })
    ])

    expect(methodsPerRequest(server)).toEqual([['Mailbox/get', 'Identity/get']])
    expect(mailboxes.list.map(mailbox => mailbox.id)).toEqual(
      server.mailboxes.map(mailbox => mailbox.id)
    )
    expect(identities.list.map(identity => identity.id)).toEqual([
      'identity-alice'
    ])
  })

  it('rejects only the call that failed', async () => {
    const server = makeFakeJmapServer()
    server.methodErrors.set('Identity/get', 'serverFail')
    const client = makeClient(server)
    await client.getSession()

    const [mailboxes, identities] = await Promise.allSettled([
      client.call('Mailbox/get', { accountId: FAKE_ACCOUNT_ID, ids: null }),
      client.call('Identity/get', { accountId: FAKE_ACCOUNT_ID, ids: null })
    ])

    expect(server.requests).toHaveLength(1)
    expect(mailboxes.status).toBe('fulfilled')
    expect(identities.status).toBe('rejected')
    expect(
      identities.status === 'rejected' &&
        identities.reason instanceof JmapMethodError
    ).toBe(true)
  })

  it('rejects every caller of a shared request lost on the way', async () => {
    const server = makeFakeJmapServer()
    server.loseNextResponse('Identity/get')
    const client = makeClient(server)
    await client.getSession()

    const [mailboxes, identities] = await Promise.allSettled([
      client.call('Mailbox/get', { accountId: FAKE_ACCOUNT_ID, ids: null }),
      client.call('Identity/get', { accountId: FAKE_ACCOUNT_ID, ids: null })
    ])

    expect(methodsPerRequest(server)).toEqual([['Mailbox/get', 'Identity/get']])
    expect(mailboxes.status).toBe('rejected')
    expect(identities.status).toBe('rejected')
  })

  it('sends a write alone, so a read lost on the way does not fail it', async () => {
    const server = makeFakeJmapServer()
    server.loseNextResponse('Mailbox/get')
    const client = makeClient(server)
    await client.getSession()

    const [mailboxes, seen] = await Promise.allSettled([
      client.call('Mailbox/get', { accountId: FAKE_ACCOUNT_ID, ids: null }),
      client.call('Email/set', {
        accountId: FAKE_ACCOUNT_ID,
        update: { 'email-1': { 'keywords/$seen': true } }
      })
    ])

    expect(methodsPerRequest(server).sort()).toEqual([
      ['Email/set'],
      ['Mailbox/get']
    ])
    expect(mailboxes.status).toBe('rejected')
    expect(seen.status).toBe('fulfilled')
  })

  it('sends at most maxCalls calls per request', async () => {
    const server = makeFakeJmapServer()
    const client = makeClient(server, 2)
    await client.getSession()

    await Promise.all(
      Array.from({ length: 5 }, () =>
        client.call('Mailbox/get', { accountId: FAKE_ACCOUNT_ID, ids: null })
      )
    )

    expect(methodsPerRequest(server).map(methods => methods.length)).toEqual([
      2, 2, 1
    ])
  })

  it('does not put together calls asking for other capabilities', async () => {
    const server = makeFakeJmapServer()
    const client = makeClient(server)
    await client.getSession()

    await Promise.all([
      client.call('Mailbox/get', { accountId: FAKE_ACCOUNT_ID, ids: null }),
      client.call(
        'Mailbox/get',
        { accountId: FAKE_ACCOUNT_ID, ids: null },
        { extraCapabilities: ['urn:apache:james:params:jmap:mail:shares'] }
      )
    ])

    expect(server.requests).toHaveLength(2)
    expect(
      server.requests.map(request =>
        request.using.includes('urn:apache:james:params:jmap:mail:shares')
      )
    ).toEqual([false, true])
  })

  it('sends the calls made later in another request', async () => {
    const server = makeFakeJmapServer()
    const client = makeClient(server)
    await client.getSession()

    await client.call('Mailbox/get', { accountId: FAKE_ACCOUNT_ID, ids: null })
    await client.call('Identity/get', { accountId: FAKE_ACCOUNT_ID, ids: null })

    expect(methodsPerRequest(server)).toEqual([
      ['Mailbox/get'],
      ['Identity/get']
    ])
  })

  it('rejects an aborted caller at once and still answers the others', async () => {
    const server = makeFakeJmapServer()
    const client = makeClient(server)
    await client.getSession()
    const controller = new AbortController()

    const aborted = client.call(
      'Identity/get',
      { accountId: FAKE_ACCOUNT_ID, ids: null },
      { signal: controller.signal }
    )
    const kept = client.call('Mailbox/get', {
      accountId: FAKE_ACCOUNT_ID,
      ids: null
    })
    controller.abort()

    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' })
    await expect(kept).resolves.toMatchObject({ accountId: FAKE_ACCOUNT_ID })
    expect(methodsPerRequest(server)).toEqual([['Mailbox/get']])
  })

  it('rejects a call whose signal is already aborted without sending it', async () => {
    const server = makeFakeJmapServer()
    const client = makeClient(server)
    await client.getSession()

    await expect(
      client.call(
        'Mailbox/get',
        { accountId: FAKE_ACCOUNT_ID, ids: null },
        { signal: AbortSignal.abort() }
      )
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(server.requests).toHaveLength(0)
  })
})
