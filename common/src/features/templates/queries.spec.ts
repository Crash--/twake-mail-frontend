import { QueryClient } from '@tanstack/react-query'
import { createClient } from 'jmap-client-ts'
import { METHOD_CAPABILITIES } from '@common/jmap/methodCapabilities'

import {
  FAKE_ACCOUNT_ID,
  FAKE_SESSION_URL,
  makeEmail,
  makeFakeJmapServer
} from '@common/testing/fakeJmapServer'

import { templatesQueryOptions } from './queries'

describe('templatesQueryOptions', () => {
  it('asks no more templates per folder than maxObjectsInGet', async () => {
    const server = makeFakeJmapServer({
      maxObjectsInGet: 10,
      emails: Array.from({ length: 15 }, (_, index) =>
        makeEmail({
          id: `t${index}`,
          mailboxIds: { 'mailbox-templates': true }
        })
      )
    })
    const client = createClient({
      sessionUrl: FAKE_SESSION_URL,
      fetch: server.fetch,
      methodCapabilities: METHOD_CAPABILITIES
    })

    const templates = await new QueryClient().query(
      templatesQueryOptions(client, FAKE_ACCOUNT_ID, ['mailbox-templates'])
    )

    expect(templates).toHaveLength(10)
    expect(server.callsOf('Email/query').map(args => args.limit)).toEqual([10])
  })
})
