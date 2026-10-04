import { makeMailbox } from '@common/testing/fakeJmapServer'

import { normalizeMailbox } from './queries'

describe('normalizeMailbox', () => {
  it('reads the properties James leaves out as null, and subscribed', () => {
    const {
      role: _role,
      namespace: _namespace,
      isSubscribed: _sub,
      ...sent
    } = makeMailbox({ id: 'work', name: 'Work' })

    expect(normalizeMailbox(sent)).toMatchObject({
      role: null,
      namespace: null,
      isSubscribed: true
    })
  })
})
