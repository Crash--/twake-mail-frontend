import { createClient, type JmapClient } from 'jmap-client-ts'
import { METHOD_CAPABILITIES } from '@common/jmap/methodCapabilities'

import {
  FAKE_ACCOUNT_ID,
  FAKE_SESSION_URL,
  makeEmail,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'

import { getInChunks } from './maxObjectsInGet'

function makeClient(server: FakeJmapServer): JmapClient {
  return createClient({
    sessionUrl: FAKE_SESSION_URL,
    fetch: server.fetch,
    methodCapabilities: METHOD_CAPABILITIES
  })
}

function getIds(
  client: JmapClient,
  ids: readonly string[]
): ReturnType<typeof getInChunks<{ id: string }>> {
  return getInChunks(client, ids, (builder, chunk) =>
    builder.call('Email/get', {
      accountId: FAKE_ACCOUNT_ID,
      ids: chunk,
      properties: ['id']
    })
  )
}

/** The ids each `Email/get` asked, a request per call */
function idsPerRequest(server: FakeJmapServer): number[] {
  return server.requests.flatMap(request =>
    request.methodCalls
      .filter(([name]) => name === 'Email/get')
      .map(([, args]) => (Array.isArray(args.ids) ? args.ids.length : 0))
  )
}

function makeIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `e${index}`)
}

describe('getInChunks', () => {
  it('asks each chunk of maxObjectsInGet in a request of its own', async () => {
    const emails = makeIds(120).map(id => makeEmail({ id }))
    const server = makeFakeJmapServer({ emails, maxObjectsInGet: 50 })

    const found = await getIds(
      makeClient(server),
      emails.map(email => email.id)
    )

    expect(found.list.map(email => email.id)).toEqual(
      emails.map(email => email.id)
    )
    expect(server.requests.map(request => request.methodCalls.length)).toEqual([
      1, 1, 1
    ])
    expect(idsPerRequest(server)).toEqual([50, 50, 20])
  })

  it('cuts by 50, or the size given, when the session does not tell', async () => {
    const server = makeFakeJmapServer({ maxObjectsInGet: null })
    const client = makeClient(server)

    await getIds(client, makeIds(60))
    const byDefault = idsPerRequest(server)
    server.requests.length = 0
    await getInChunks(
      client,
      makeIds(60),
      (builder, chunk) =>
        builder.call('Email/get', {
          accountId: FAKE_ACCOUNT_ID,
          ids: chunk,
          properties: ['id']
        }),
      { fallbackSize: 20 }
    )

    expect(byDefault).toEqual([50, 10])
    expect(idsPerRequest(server)).toEqual([20, 20, 20])
  })

  it('halves a chunk the server refuses as too large', async () => {
    const emails = makeIds(50).map(id => makeEmail({ id }))
    // The session tells 50, the server takes 30
    const server = makeFakeJmapServer({
      emails,
      maxObjectsInGet: 50,
      actualMaxObjectsInGet: 30
    })

    const found = await getIds(
      makeClient(server),
      emails.map(email => email.id)
    )

    expect(found.list).toHaveLength(50)
    expect(idsPerRequest(server)).toEqual([50, 25, 25])
  })

  it('asks one call for no id', async () => {
    const server = makeFakeJmapServer()

    const found = await getIds(makeClient(server), [])

    expect(found.list).toEqual([])
    expect(found.state).toBe(server.states().Email)
  })
})
