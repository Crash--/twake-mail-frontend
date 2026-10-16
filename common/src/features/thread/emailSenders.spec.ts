import { createClient } from 'jmap-client-ts'
import { LINAGORA_METHOD_CAPABILITIES } from 'jmap-client-ts/linagora'

import {
  FAKE_ACCOUNT_ID,
  FAKE_SESSION_URL,
  makeEmail,
  makeFakeJmapServer
} from '@common/testing/fakeJmapServer'

import { fetchEmailSenders } from './emailSenders'

describe('fetchEmailSenders', () => {
  it('reads the senders of more emails than maxObjectsInGet', async () => {
    const emails = Array.from({ length: 15 }, (_, index) =>
      makeEmail({
        id: `e${index}`,
        from: [{ name: `Sender ${index}`, email: `s${index}@example.com` }]
      })
    )
    const server = makeFakeJmapServer({ emails, maxObjectsInGet: 10 })
    const client = createClient({
      sessionUrl: FAKE_SESSION_URL,
      fetch: server.fetch,
      methodCapabilities: LINAGORA_METHOD_CAPABILITIES
    })

    const senders = await fetchEmailSenders(
      client,
      FAKE_ACCOUNT_ID,
      emails.map(email => email.id)
    )

    expect(senders.map(sender => sender.email)).toEqual(
      emails.map((_, index) => `s${index}@example.com`)
    )
  })
})
