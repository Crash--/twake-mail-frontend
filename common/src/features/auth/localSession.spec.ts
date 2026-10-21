import {
  listComposers,
  putComposer,
  resumeComposerStorage
} from '@common/features/composer/composerStorage'
import {
  addRecentSearch,
  readRecentSearches,
  readSortOrder,
  storeSortOrder
} from '@common/features/search/searchStorage'
import { clearMailboxViews } from '@common/jmap/mailboxView'

import {
  endLocalSession,
  onSessionEndedElsewhere,
  SESSION_CHANNEL_NAME
} from './localSession'
import { ANONYMOUS, type AuthState } from './types'

// Kept in the session storage of the tab, which this environment lacks
jest.mock('@common/jmap/mailboxView', () => ({
  clearMailboxViews: jest.fn()
}))

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

/**
 * The browser storage of the page: Node has none, and the search storage
 * reads `window.localStorage`
 */
function installLocalStorage(): void {
  const values = new Map<string, string>()
  const localStorage: Pick<
    Storage,
    'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'
  > = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: key => {
      values.delete(key)
    },
    key: index => [...values.keys()][index] ?? null,
    get length(): number {
      return values.size
    }
  }
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage },
    configurable: true
  })
}

beforeEach(installLocalStorage)

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window')
})

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

    expect(session.clearLocalSession).toHaveBeenCalledWith('signed-out')
    expect(await listComposers('a')).toEqual([])
  })

  it('forgets the recent searches and keeps the sort order', () => {
    addRecentSearch('a', 'SecretTerm')
    storeSortOrder('oldest')

    endLocalSession(makeSession(ANONYMOUS))

    expect(readRecentSearches('a')).toEqual([])
    expect(readSortOrder()).toBe('oldest')
  })

  it('forgets the mailbox shown: the next sign-in opens on the own one', () => {
    endLocalSession(makeSession(signedInAs('bob@example.com')))

    expect(clearMailboxViews).toHaveBeenCalledTimes(1)
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

      expect(thisTab.clearLocalSession).toHaveBeenCalledWith('signed-out')
      stop()
    }
  )

  it('forgets the recent searches written in this tab meanwhile', async () => {
    const thisTab = makeSession(signedInAs('alice@example.com'))
    const stop = onSessionEndedElsewhere(thisTab)
    const received = nextMessage()

    endLocalSession(makeSession(signedInAs('alice@example.com')))
    // What this tab wrote after the other tab cleared the storage
    addRecentSearch('a', 'SecretTerm')
    await received

    expect(readRecentSearches('a')).toEqual([])
    stop()
  })

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
