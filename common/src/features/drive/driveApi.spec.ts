import { exchangeDriveToken } from './driveApi'

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
})
