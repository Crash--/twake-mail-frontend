import { makeJmapAuth, NotAuthenticatedError } from './makeJmapAuth'

describe('makeJmapAuth', () => {
  it('hands the authorization header to the JMAP client', async () => {
    const auth = makeJmapAuth({
      getAuthorizationHeader: () => Promise.resolve('Bearer token'),
      onUnauthorized: () => Promise.resolve(true)
    })

    await expect(auth.getAuthorizationHeader()).resolves.toBe('Bearer token')
    await expect(auth.onUnauthorized()).resolves.toBe(true)
  })

  it('fails the request when signed out', async () => {
    const auth = makeJmapAuth({
      getAuthorizationHeader: () => Promise.resolve(null),
      onUnauthorized: () => Promise.resolve(false)
    })

    await expect(auth.getAuthorizationHeader()).rejects.toBeInstanceOf(
      NotAuthenticatedError
    )
  })
})
