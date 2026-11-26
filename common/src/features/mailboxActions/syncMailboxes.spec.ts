import { QueryClient } from '@tanstack/react-query'
import { createClient, type JmapClient } from '@linagora/jmap-client-ts'

import {
  mailboxKeys,
  type MailboxListData
} from '@common/features/mailbox/queries'
import { METHOD_CAPABILITIES } from '@common/jmap/methodCapabilities'
import {
  FAKE_ACCOUNT_ID,
  FAKE_SESSION_URL,
  makeFakeJmapServer,
  makeMailbox,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'

import { syncMailboxes } from './syncMailboxes'

function makeClient(server: FakeJmapServer): JmapClient {
  return createClient({
    sessionUrl: FAKE_SESSION_URL,
    fetch: server.fetch,
    methodCapabilities: METHOD_CAPABILITIES
  })
}

function makeServer(): FakeJmapServer {
  return makeFakeJmapServer({
    mailboxes: [
      makeMailbox({ id: 'inbox', name: 'Inbox', role: 'inbox' }),
      makeMailbox({ id: 'work', name: 'Work' })
    ]
  })
}

function fullListCalls(server: FakeJmapServer): number {
  return server.callsOf('Mailbox/get').filter(args => args.ids === null).length
}

function names(data: MailboxListData): string[] {
  return data.list.map(mailbox => mailbox.name).sort()
}

describe('syncMailboxes', () => {
  it('fetches every folder when none is cached', async () => {
    const server = makeServer()
    const queryClient = new QueryClient()

    const data = await syncMailboxes(
      makeClient(server),
      queryClient,
      FAKE_ACCOUNT_ID
    )

    expect(names(data)).toEqual(['Inbox', 'Work'])
    expect(fullListCalls(server)).toBe(1)
    expect(server.callsOf('Mailbox/changes')).toHaveLength(0)
  })

  it('patches the cached folders with the changes since their state', async () => {
    const server = makeServer()
    const client = makeClient(server)
    const queryClient = new QueryClient()
    await syncMailboxes(client, queryClient, FAKE_ACCOUNT_ID)

    const response = await client.call('Mailbox/set', {
      accountId: FAKE_ACCOUNT_ID,
      create: { folder: { name: 'Perf', parentId: null } },
      destroy: ['work']
    })
    const createdId = response.created?.folder?.id
    const data = await syncMailboxes(client, queryClient, FAKE_ACCOUNT_ID)

    expect(names(data)).toEqual(['Inbox', 'Perf'])
    expect(data.list.some(mailbox => mailbox.id === createdId)).toBe(true)
    expect(data.state).toBe(server.states().Mailbox)
    expect(fullListCalls(server)).toBe(1)
    expect(server.callsOf('Mailbox/changes')).toHaveLength(1)
    expect(
      queryClient.getQueryData<MailboxListData>(
        mailboxKeys.list(FAKE_ACCOUNT_ID)
      )
    ).toEqual(data)
  })

  it('fetches every folder again when the server cannot tell the changes', async () => {
    const server = makeServer()
    const client = makeClient(server)
    const queryClient = new QueryClient()
    await syncMailboxes(client, queryClient, FAKE_ACCOUNT_ID)
    server.methodErrors.set('Mailbox/changes', 'cannotCalculateChanges')
    server.updateMailbox('work', { name: 'Job' })

    const data = await syncMailboxes(client, queryClient, FAKE_ACCOUNT_ID)

    expect(names(data)).toEqual(['Inbox', 'Job'])
    expect(fullListCalls(server)).toBe(2)
  })
})
