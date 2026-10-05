import {
  makeIdentity,
  makeMailbox,
  FAKE_USERNAME
} from '@common/testing/fakeJmapServer'

import { identityForEmail, type ReceivedEmail } from './identityForEmail'
import { sortIdentities, type IdentitySummary } from './queries'

const ACCOUNT = makeIdentity({ id: 'account', sortOrder: 0 })
const ALIAS = makeIdentity({
  id: 'alias',
  name: 'Sales',
  email: 'sales@example.com',
  mayDelete: true,
  sortOrder: 100
})
const SUPPORT = makeIdentity({
  id: 'support',
  name: 'Support',
  email: 'support@example.com',
  mayDelete: true,
  sortOrder: 50
})
const TEAM = makeIdentity({
  id: 'team',
  name: 'Team',
  email: 'team@example.com',
  mayDelete: true,
  sortOrder: 200
})
const IDENTITIES: IdentitySummary[] = sortIdentities([
  ACCOUNT,
  ALIAS,
  SUPPORT,
  TEAM
])

const MAILBOXES = [
  makeMailbox({ id: 'inbox', name: 'INBOX', role: 'inbox' }),
  makeMailbox({
    id: 'team-root',
    name: 'team',
    namespace: 'TeamMailbox[team@example.com]'
  }),
  makeMailbox({
    id: 'team-inbox',
    name: 'INBOX',
    parentId: 'team-root',
    namespace: 'TeamMailbox[team@example.com]'
  }),
  makeMailbox({
    id: 'other-inbox',
    name: 'INBOX',
    namespace: 'TeamMailbox[other@example.com]'
  })
]

function email(overrides: Partial<ReceivedEmail> = {}): ReceivedEmail {
  return {
    mailboxIds: { inbox: true },
    to: [{ name: null, email: FAKE_USERNAME }],
    cc: null,
    bcc: null,
    ...overrides
  }
}

function choose(
  received: ReceivedEmail,
  identities: readonly IdentitySummary[] = IDENTITIES
): { id: string | null; receivedAt: string | null } {
  const { identity, receivedAt } = identityForEmail(received, {
    identities,
    mailboxes: MAILBOXES
  })
  return { id: identity?.id ?? null, receivedAt }
}

describe('identityForEmail', () => {
  it('takes the identity of the team mailbox the email is in', () => {
    expect(choose(email({ mailboxIds: { 'team-root': true } }))).toEqual({
      id: 'team',
      receivedAt: 'team@example.com'
    })
  })

  it('takes it in a folder of the team mailbox too', () => {
    expect(choose(email({ mailboxIds: { 'team-inbox': true } }))).toEqual({
      id: 'team',
      receivedAt: 'team@example.com'
    })
  })

  it('names the team mailbox and takes the default identity without its identity', () => {
    expect(choose(email({ mailboxIds: { 'other-inbox': true } }))).toEqual({
      id: 'account',
      receivedAt: 'other@example.com'
    })
  })

  it('takes the alias the email was sent to, in To or Cc', () => {
    expect(
      choose(email({ to: [{ name: 'Sales', email: 'sales@example.com' }] }))
    ).toEqual({ id: 'alias', receivedAt: 'sales@example.com' })
    expect(
      choose(
        email({
          to: [{ name: null, email: 'bob@example.com' }],
          cc: [{ name: null, email: 'sales@example.com' }]
        })
      )
    ).toEqual({ id: 'alias', receivedAt: 'sales@example.com' })
  })

  it('takes the lowest sortOrder of several matches', () => {
    expect(
      choose(
        email({
          to: [
            { name: null, email: 'sales@example.com' },
            { name: null, email: 'support@example.com' }
          ]
        })
      ).id
    ).toBe('support')
  })

  it('reads Bcc after To and Cc', () => {
    expect(
      choose(
        email({
          to: [{ name: null, email: 'bob@example.com' }],
          bcc: [{ name: null, email: 'support@example.com' }]
        })
      ).id
    ).toBe('support')
  })

  it('ignores the case of the addresses', () => {
    expect(
      choose(email({ to: [{ name: null, email: 'SALES@Example.COM' }] })).id
    ).toBe('alias')
  })

  it('takes the default identity when nothing matches', () => {
    expect(
      choose(email({ to: [{ name: null, email: 'list@example.com' }] }))
    ).toEqual({ id: 'account', receivedAt: null })
    expect(choose(email(), [])).toEqual({ id: null, receivedAt: null })
  })
})
