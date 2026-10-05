import {
  createDriveIntent,
  exchangeDriveToken,
  resolveDriveUrl
} from './driveApi'

function fakeFetch(
  status: number,
  body: unknown
): jest.Mock<Promise<Response>, Parameters<typeof fetch>> {
  return jest.fn((..._args: Parameters<typeof fetch>) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
      })
    )
  )
}

describe('Drive API', () => {
  it('resolves the Drive of the user, https only', () => {
    const context = {
      username: 'user1@twake.example.com',
      workplaceFqdn: null,
      workplaceFqdnFallback: '{localpart}.twake.example.com'
    }
    expect(resolveDriveUrl('https://{workplaceFqdn}/', context)).toBe(
      'https://user1.twake.example.com'
    )
    expect(resolveDriveUrl('https://{localpart}.example.com', context)).toBe(
      'https://user1.example.com'
    )
    expect(resolveDriveUrl('http://{localpart}.example.com', context)).toBe(
      null
    )
    expect(resolveDriveUrl(null, context)).toBe(null)
    expect(
      resolveDriveUrl('https://{workplaceFqdn}', {
        ...context,
        workplaceFqdnFallback: null
      })
    ).toBe(null)
  })

  it('trades the ID token for a Drive token', async () => {
    const fetchFunction = fakeFetch(200, { access_token: 'drive-token' })

    await expect(
      exchangeDriveToken('https://user1.example.com', 'id-token', fetchFunction)
    ).resolves.toEqual({ ok: true, value: 'drive-token' })
    const [url, init] = fetchFunction.mock.calls[0] ?? []
    expect(url).toBe('https://user1.example.com/auth/token_exchange')
    expect(init?.method).toBe('POST')
    expect(init?.credentials).toBe('omit')
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual(
      {
        id_token: 'id-token',
        exchange_type: 'app'
      }
    )
  })

  it('says why the exchange failed', async () => {
    await expect(
      exchangeDriveToken(
        'https://user1.example.com',
        'id-token',
        fakeFetch(403, {
          error: 'the origin of this application is not allowed'
        })
      )
    ).resolves.toEqual({ ok: false, error: 'token' })
    await expect(
      exchangeDriveToken('https://user1.example.com', 'id-token', () =>
        Promise.reject(new TypeError('Failed to fetch'))
      )
    ).resolves.toEqual({ ok: false, error: 'network' })
  })

  it('creates the PICK intent with the Drive token', async () => {
    const fetchFunction = fakeFetch(200, {
      data: {
        id: 'intent-1',
        attributes: {
          services: [{ href: 'https://user1-drive.example.com/#/pick' }]
        }
      }
    })

    await expect(
      createDriveIntent(
        'https://user1.example.com',
        'drive-token',
        { multiple: true },
        fetchFunction
      )
    ).resolves.toEqual({
      ok: true,
      value: {
        id: 'intent-1',
        href: 'https://user1-drive.example.com/#/pick',
        origin: 'https://user1-drive.example.com'
      }
    })
    const [url, init] = fetchFunction.mock.calls[0] ?? []
    expect(url).toBe('https://user1.example.com/intents?force_session_id=true')
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer drive-token'
    )
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual(
      {
        data: {
          type: 'io.cozy.intents',
          attributes: {
            action: 'PICK',
            type: 'io.cozy.files',
            data: { multiple: true },
            permissions: ['GET']
          }
        }
      }
    )
  })
})
