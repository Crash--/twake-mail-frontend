import {
  BASIC_SESSION_CHANNEL_NAME,
  makeBasicSessionSharing,
  type BasicSessionSharing
} from './basicSessionSharing'

const ALICE = { email: 'alice@example.com', authorizationHeader: 'Basic YWxp' }

function makeSharing(timeoutMs = 100): BasicSessionSharing {
  const sharing = makeBasicSessionSharing(timeoutMs)
  if (sharing === null) throw new Error('BroadcastChannel is missing')
  return sharing
}

describe('makeBasicSessionSharing', () => {
  it('gets the session of a signed-in tab', async () => {
    const stopSharing = makeSharing().share(() => ALICE)

    await expect(makeSharing().request()).resolves.toEqual(ALICE)

    stopSharing()
  })

  it('gets nothing when no tab is signed in', async () => {
    const stopSharing = makeSharing().share(() => null)

    await expect(makeSharing().request()).resolves.toBe(null)

    stopSharing()
  })

  it('gets nothing once the signed-in tab stops sharing', async () => {
    makeSharing().share(() => ALICE)()

    await expect(makeSharing().request()).resolves.toBe(null)
  })

  it('ignores a malformed offer', async () => {
    const channel = new BroadcastChannel(BASIC_SESSION_CHANNEL_NAME)
    channel.onmessage = (): void => {
      channel.postMessage({
        type: 'basic-session-offer',
        email: 'alice@example.com',
        authorizationHeader: 'Bearer token'
      })
    }

    await expect(makeSharing().request()).resolves.toBe(null)

    channel.close()
  })
})
