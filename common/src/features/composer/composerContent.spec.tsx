import { makeIdentity } from '@common/testing/fakeJmapServer'

import { newMessageContent } from './composerContent'

describe('newMessageContent', () => {
  const identities = [
    makeIdentity({ id: 'alice', email: 'alice@example.com' }),
    makeIdentity({ id: 'team', email: 'Team@example.com', name: 'team' })
  ]

  it('writes from the default identity', () => {
    expect(newMessageContent(identities).identityId).toBe('alice')
  })

  it('writes from the identity of an address, without case', () => {
    expect(
      newMessageContent(identities, undefined, 'team@example.com').identityId
    ).toBe('team')
  })

  it('falls back to the default identity when no identity has the address', () => {
    expect(
      newMessageContent(identities, undefined, 'other@example.com').identityId
    ).toBe('alice')
  })
})
