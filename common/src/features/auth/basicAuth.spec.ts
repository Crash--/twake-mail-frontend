import {
  createBasicAuthService,
  makeBasicAuthorizationHeader
} from './basicAuth'

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

    expect(service.getState()).toEqual({ status: 'anonymous' })
    expect(postMessage).toHaveBeenCalledWith({
      type: 'session-ended',
      email: 'alice@example.com'
    })
  })
})
