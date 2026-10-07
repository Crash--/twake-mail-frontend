import {
  listComposers,
  putComposer,
  resumeComposerStorage
} from '@common/features/composer/composerStorage'

import {
  endLocalSession,
  onSessionEndedElsewhere,
  SESSION_CHANNEL_NAME
} from './localSession'
import { ANONYMOUS, type AuthState } from './types'

function signedInAs(email: string | null): AuthState {
  return {
    status: 'authenticated',
    user: { email, name: null, workplaceFqdn: null }
  }
}

function makeSession(state: AuthState): {
  getState: () => AuthState
  clearLocalSession: jest.Mock
} {
  return { getState: () => state, clearLocalSession: jest.fn() }
}

/** Lets the other tab receive what was posted on the channel */
function nextMessage(): Promise<void> {
  return new Promise(resolve => {
    const channel = new BroadcastChannel(SESSION_CHANNEL_NAME)
    channel.onmessage = (): void => {
      channel.close()
      setTimeout(resolve, 0)
    }
  })
}

describe('endLocalSession', () => {
  it('forgets the composers kept in the browser', async () => {
    resumeComposerStorage()
    await putComposer({
      accountId: 'a',
      composerId: 'one',
      entry: { id: 'one' },
      snapshot: null
    })
    const session = makeSession(ANONYMOUS)

    endLocalSession(session)

    expect(session.clearLocalSession).toHaveBeenCalledTimes(1)
    expect(await listComposers('a')).toEqual([])
  })
})

describe('onSessionEndedElsewhere', () => {
  it.each([
    ['the same account', 'alice@example.com', 'alice@example.com'],
    [
      'the same account in another case',
      'alice@example.com',
      'Alice@Example.com'
    ],
    ['an unknown account', null, 'alice@example.com'],
    ['a tab whose account is unknown', 'alice@example.com', null]
  ])(
    'ends the session of this tab when %s signs out',
    async (_, endingEmail, thisEmail) => {
      const thisTab = makeSession(signedInAs(thisEmail))
      const stop = onSessionEndedElsewhere(thisTab)
      const received = nextMessage()

      endLocalSession(makeSession(signedInAs(endingEmail)))
      await received

      expect(thisTab.clearLocalSession).toHaveBeenCalledTimes(1)
      stop()
    }
  )

  it('keeps this tab signed in when another account signs out', async () => {
    const bobTab = makeSession(signedInAs('bob@example.com'))
    const stop = onSessionEndedElsewhere(bobTab)
    const received = nextMessage()

    endLocalSession(makeSession(signedInAs('alice@example.com')))
    await received

    expect(bobTab.clearLocalSession).not.toHaveBeenCalled()
    stop()
  })
})
