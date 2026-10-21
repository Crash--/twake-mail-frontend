import { createClient, type JmapClient } from 'jmap-client-ts'
import { METHOD_CAPABILITIES } from '@common/jmap/methodCapabilities'

import {
  FAKE_ACCOUNT_ID,
  FAKE_SESSION_URL,
  makeEmail,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'

import type { EmailChange } from './planEmailChanges'
import { sendEmailChanges } from './sendEmailChanges'

const INBOX = 'mailbox-inbox'

function makeSetup(): { server: FakeJmapServer; client: JmapClient } {
  const server = makeFakeJmapServer({
    emails: ['e0', 'e1', 'e2'].map(id => makeEmail({ id }))
  })
  const client = createClient({
    sessionUrl: FAKE_SESSION_URL,
    auth: { getAuthorizationHeader: () => Promise.resolve('Basic dGVzdA==') },
    fetch: server.fetch,
    methodCapabilities: METHOD_CAPABILITIES
  })
  return { server, client }
}

function read(id: string): EmailChange {
  return {
    before: { id, mailboxIds: { [INBOX]: true }, keywords: {} },
    after: { id, mailboxIds: { [INBOX]: true }, keywords: { $seen: true } }
  }
}

describe('sendEmailChanges', () => {
  it('tells the state each accepted request moved from and to', async () => {
    const { server, client } = makeSetup()
    const initial = server.states().Email
    const onStateChanged = jest.fn<undefined, [string, string]>()

    const result = await sendEmailChanges(
      client,
      FAKE_ACCOUNT_ID,
      [read('e0'), read('e1'), read('e2')],
      { batchSize: 2, onStateChanged }
    )

    expect(result).toEqual({ failedIds: [], error: null })
    expect(onStateChanged).toHaveBeenCalledTimes(2)
    expect(onStateChanged.mock.calls[0]?.[0]).toBe(initial)
    expect(onStateChanged.mock.calls[1]?.[0]).toBe(
      onStateChanged.mock.calls[0]?.[1]
    )
    expect(onStateChanged.mock.calls[1]?.[1]).toBe(server.states().Email)
  })

  it('does not tell the state of a request refused in part', async () => {
    const { server, client } = makeSetup()
    server.setErrors.set('e1', 'forbidden')
    const onStateChanged = jest.fn<undefined, [string, string]>()

    const result = await sendEmailChanges(
      client,
      FAKE_ACCOUNT_ID,
      [read('e0'), read('e1')],
      { batchSize: 50, onStateChanged }
    )

    expect(result.failedIds).toEqual(['e1'])
    expect(onStateChanged).not.toHaveBeenCalled()
  })
})
