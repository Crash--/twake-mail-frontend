import {
  createBasicAuthService,
  makeBasicAuthorizationHeader,
  SIGNED_OUT_KEY
} from './basicAuth'
import type {
  BasicSessionSharing,
  SharedBasicSession
} from './basicSessionSharing'

const SESSION_URL = 'https://jmap.example.com/jmap/session'

function makeFetch(
  response: { ok: boolean; status: number } | Error
): jest.Mock {
  return jest.fn(() =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response)
  )
}

describe('makeBasicAuthorizationHeader', () => {
  it('encodes the credentials as UTF-8', () => {
    expect(makeBasicAuthorizationHeader('élise', 'pässword')).toBe(
      `Basic ${Buffer.from('élise:pässword', 'utf8').toString('base64')}`
    )
  })
})

describe('createBasicAuthService', () => {
  it('signs in when the JMAP session answers 200', async () => {
    const fetch = makeFetch({ ok: true, status: 200 })
    const service = createBasicAuthService(
      { jmapSessionUrl: SESSION_URL },
      { fetch }
    )

    const result = await service.login(' alice@example.com ', 'secret')

    expect(result).toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledWith(
      SESSION_URL,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: makeBasicAuthorizationHeader(
            'alice@example.com',
            'secret'
          )
        })
      })
    )
    expect(service.getState()).toEqual({
      status: 'authenticated',
      user: { email: 'alice@example.com', name: null, workplaceFqdn: null }
    })
    await expect(service.getAuthorizationHeader()).resolves.toBe(
      makeBasicAuthorizationHeader('alice@example.com', 'secret')
    )
  })

  it('reports bad credentials on 401 and stays signed out', async () => {
    const service = createBasicAuthService(
      { jmapSessionUrl: SESSION_URL },
      { fetch: makeFetch({ ok: false, status: 401 }) }
    )

    const result = await service.login('alice@example.com', 'wrong')

    expect(result).toEqual({ ok: false, error: 'invalid-credentials' })
    expect(service.getState()).toEqual({ status: 'anonymous' })
    await expect(service.getAuthorizationHeader()).resolves.toBe(null)
  })

  it('reports a network error when the server is unreachable', async () => {
    const service = createBasicAuthService(
      { jmapSessionUrl: SESSION_URL },
      { fetch: makeFetch(new TypeError('Failed to fetch')) }
    )

    await expect(service.login('alice@example.com', 'secret')).resolves.toEqual(
      { ok: false, error: 'network-error' }
    )
  })

  it('reports an unexpected response on a server error', async () => {
    const service = createBasicAuthService(
      { jmapSessionUrl: SESSION_URL },
      { fetch: makeFetch({ ok: false, status: 502 }) }
    )

    await expect(service.login('alice@example.com', 'secret')).resolves.toEqual(
      { ok: false, error: 'unexpected-response' }
    )
  })

  it('drops the credentials when the server rejects them later', async () => {
    const service = createBasicAuthService(
      { jmapSessionUrl: SESSION_URL },
      { fetch: makeFetch({ ok: true, status: 200 }) }
    )
    await service.login('alice@example.com', 'secret')

    await expect(service.onUnauthorized()).resolves.toBe(false)

    expect(service.getState()).toEqual({ status: 'anonymous' })
    await expect(service.getAuthorizationHeader()).resolves.toBe(null)
  })

  it('tells the other tabs when logging out', async () => {
    const postMessage = jest.spyOn(BroadcastChannel.prototype, 'postMessage')
    const service = createBasicAuthService(
      { jmapSessionUrl: SESSION_URL },
      { fetch: makeFetch({ ok: true, status: 200 }) }
    )
    await service.login('alice@example.com', 'secret')

    await service.logout()

    expect(service.getState()).toEqual({ status: 'anonymous', signedOut: true })
    expect(postMessage).toHaveBeenCalledWith({
      type: 'session-ended',
      email: 'alice@example.com'
    })
  })
})

describe('createBasicAuthService after a sign-out', () => {
  function makeStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
    const items = new Map<string, string>()
    return {
      getItem: key => items.get(key) ?? null,
      setItem: (key, value) => {
        items.set(key, value)
      },
      removeItem: key => {
        items.delete(key)
      }
    }
  }

  function makeService(
    storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  ): ReturnType<typeof createBasicAuthService> {
    return createBasicAuthService(
      { jmapSessionUrl: SESSION_URL },
      { fetch: makeFetch({ ok: true, status: 200 }), storage }
    )
  }

  it('starts signed out on a page loaded after a sign-out in the tab', async () => {
    const storage = makeStorage()
    const service = makeService(storage)
    await service.login('alice@example.com', 'secret')
    await service.logout()

    const nextPage = makeService(storage)

    expect(nextPage.getState()).toEqual({
      status: 'anonymous',
      signedOut: true
    })
    expect(storage.getItem(SIGNED_OUT_KEY)).toBe('true')
  })

  it('forgets the sign-out once signed in again', async () => {
    const storage = makeStorage()
    const service = makeService(storage)
    service.clearLocalSession('signed-out')
    await service.login('alice@example.com', 'secret')

    expect(makeService(storage).getState()).toEqual({ status: 'anonymous' })
  })

  it('starts without a sign-out when the session was lost', () => {
    const storage = makeStorage()
    makeService(storage).clearLocalSession('lost')

    expect(makeService(storage).getState()).toEqual({ status: 'anonymous' })
  })
})

/** Lets the session of the other tab arrive */
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('createBasicAuthService with another tab', () => {
  const ALICE_HEADER = makeBasicAuthorizationHeader('alice@example.com', 'x')

  /** The other tabs: `answer` settles the request of the new tab */
  function makeOtherTabs(): {
    sessionSharing: BasicSessionSharing
    answer: (session: SharedBasicSession | null) => void
    getSharedSession: () => SharedBasicSession | null
  } {
    let answer: (value: SharedBasicSession | null) => void = () => undefined
    let getSharedSession: () => SharedBasicSession | null = () => null
    const request = new Promise<SharedBasicSession | null>(resolve => {
      answer = resolve
    })
    return {
      sessionSharing: {
        request: () => request,
        share: getSession => {
          getSharedSession = getSession
          return () => undefined
        }
      },
      answer: value => answer(value),
      getSharedSession: () => getSharedSession()
    }
  }

  function makeService(
    sessionSharing: BasicSessionSharing
  ): ReturnType<typeof createBasicAuthService> {
    return createBasicAuthService(
      { jmapSessionUrl: SESSION_URL },
      { fetch: makeFetch({ ok: true, status: 200 }), sessionSharing }
    )
  }

  it('takes the session of a signed-in tab', async () => {
    const { sessionSharing, answer } = makeOtherTabs()
    const service = makeService(sessionSharing)

    expect(service.getState()).toEqual({ status: 'restoring' })
    answer({ email: 'alice@example.com', authorizationHeader: ALICE_HEADER })
    await flush()

    await expect(service.getAuthorizationHeader()).resolves.toBe(ALICE_HEADER)
    expect(service.getState()).toEqual({
      status: 'authenticated',
      user: { email: 'alice@example.com', name: null, workplaceFqdn: null }
    })
  })

  it('asks to sign in when no tab answers', async () => {
    const { sessionSharing, answer } = makeOtherTabs()
    const service = makeService(sessionSharing)

    answer(null)
    await flush()

    expect(service.getState()).toEqual({ status: 'anonymous' })
  })

  it('keeps the account the user signed in with meanwhile', async () => {
    const { sessionSharing, answer } = makeOtherTabs()
    const service = makeService(sessionSharing)
    await service.login('bob@example.com', 'secret')

    answer({ email: 'alice@example.com', authorizationHeader: ALICE_HEADER })
    await flush()

    expect(service.getState()).toMatchObject({
      user: { email: 'bob@example.com' }
    })
  })

  it('shares its session once signed in, and no longer once signed out', async () => {
    const { sessionSharing, answer, getSharedSession } = makeOtherTabs()
    const service = makeService(sessionSharing)
    answer(null)
    expect(getSharedSession()).toBe(null)

    await service.login('alice@example.com', 'x')
    expect(getSharedSession()).toEqual({
      email: 'alice@example.com',
      authorizationHeader: ALICE_HEADER
    })

    service.clearLocalSession()
    expect(getSharedSession()).toBe(null)
  })
})
