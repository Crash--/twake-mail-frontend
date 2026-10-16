import {
  completeConfig,
  DISCOVERED_ISSUER_STORAGE_KEY,
  type CompleteConfigDependencies
} from './completeConfig'
import { resolveConfig, type AppConfig } from './config'

/** The configuration `completeConfig` completes, when it does */
async function completedOrThrow(
  config: AppConfig,
  dependencies: CompleteConfigDependencies
): Promise<AppConfig> {
  const result = await completeConfig(config, dependencies)
  if (!result.ok) throw new Error(result.error)
  return result.value
}

function makeConfig(source: Record<string, unknown>): AppConfig {
  const result = resolveConfig(
    {
      SERVER_URL: 'https://jmap.example.com',
      AUTH_MODE: 'basic',
      ...source
    },
    'https://mail.example.com'
  )
  if (!result.ok) throw new Error(result.errors.join(', '))
  return result.value
}

const ISSUER_REL = 'http://openid.net/specs/connect/1.0/issuer'

function makeStorage(
  initial: Record<string, string> = {}
): CompleteConfigDependencies['storage'] & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    }
  }
}

function makeDependencies(
  fetchFn: typeof fetch,
  storage = makeStorage()
): CompleteConfigDependencies & { storage: ReturnType<typeof makeStorage> } {
  return { fetchFn, storage }
}

/** Answers by pathname: the documents of a stub server */
function makeServerFetch(
  documents: Record<string, unknown>
): jest.Mock<Promise<Response>, [string | URL | Request]> {
  return jest.fn((input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : input
    const document = documents[new URL(url).pathname]
    return Promise.resolve(
      document === undefined
        ? new Response('', { status: 404 })
        : Response.json(document)
    )
  })
}

describe('completeConfig', () => {
  describe('the SSO of the server', () => {
    const OIDC_SOURCE = {
      AUTH_MODE: undefined,
      WEB_OIDC_CLIENT_ID: 'teammail-web'
    }

    it('is not discovered when SSO_BASE_URL gives it', async () => {
      const fetchFn = makeServerFetch({})
      const config = makeConfig({
        ...OIDC_SOURCE,
        SSO_BASE_URL: 'https://sso.example.com'
      })

      const completed = await completedOrThrow(
        config,
        makeDependencies(fetchFn)
      )

      expect(completed.oidc?.issuerUrl).toBe('https://sso.example.com')
      expect(fetchFn).not.toHaveBeenCalled()
    })

    it('is the issuer WebFinger finds, remembered for the callback page', async () => {
      const fetchFn = makeServerFetch({
        '/.well-known/webfinger': {
          links: [{ rel: ISSUER_REL, href: 'https://sso.example.com/realms/x' }]
        }
      })
      const dependencies = makeDependencies(fetchFn)

      const completed = await completedOrThrow(
        makeConfig(OIDC_SOURCE),
        dependencies
      )

      expect(completed.authMode).toBe('oidc')
      expect(completed.oidc?.issuerUrl).toBe('https://sso.example.com/realms/x')
      expect(completed.oidc?.clientId).toBe('teammail-web')
      expect(completed.issuerDiscovery).toBe(null)
      expect(dependencies.storage.data.get(DISCOVERED_ISSUER_STORAGE_KEY)).toBe(
        JSON.stringify({
          serverUrl: 'https://jmap.example.com',
          issuer: 'https://sso.example.com/realms/x'
        })
      )
    })

    it('is the remembered issuer after the round trip to the SSO', async () => {
      const fetchFn = makeServerFetch({})
      const storage = makeStorage({
        [DISCOVERED_ISSUER_STORAGE_KEY]: JSON.stringify({
          serverUrl: 'https://jmap.example.com',
          issuer: 'https://sso.example.com/realms/x'
        })
      })

      const completed = await completedOrThrow(
        makeConfig(OIDC_SOURCE),
        makeDependencies(fetchFn, storage)
      )

      expect(completed.oidc?.issuerUrl).toBe('https://sso.example.com/realms/x')
      expect(fetchFn).not.toHaveBeenCalled()
    })

    it('ignores an issuer remembered for another server', async () => {
      const fetchFn = makeServerFetch({
        '/.well-known/webfinger': {
          links: [{ rel: ISSUER_REL, href: 'https://sso.example.com' }]
        }
      })
      const storage = makeStorage({
        [DISCOVERED_ISSUER_STORAGE_KEY]: JSON.stringify({
          serverUrl: 'https://other.example.com',
          issuer: 'https://old.example.com'
        })
      })

      const completed = await completedOrThrow(
        makeConfig(OIDC_SOURCE),
        makeDependencies(fetchFn, storage)
      )

      expect(completed.oidc?.issuerUrl).toBe('https://sso.example.com')
    })

    it('is the server itself when WebFinger finds none and it is an OpenID provider', async () => {
      const fetchFn = makeServerFetch({
        '/.well-known/openid-configuration': {
          issuer: 'https://jmap.example.com'
        }
      })

      const completed = await completedOrThrow(
        makeConfig(OIDC_SOURCE),
        makeDependencies(fetchFn)
      )

      expect(completed.authMode).toBe('oidc')
      expect(completed.oidc?.issuerUrl).toBe('https://jmap.example.com')
    })

    it('falls back to the Basic form when there is none, like tmail-flutter', async () => {
      const dependencies = makeDependencies(makeServerFetch({}))

      const completed = await completedOrThrow(
        makeConfig(OIDC_SOURCE),
        dependencies
      )

      expect(completed.authMode).toBe('basic')
      expect(completed.oidc).toBe(null)
      expect(completed.issuerDiscovery).toBe(null)
      expect(dependencies.storage.data.size).toBe(0)
    })

    it('falls back to the Basic form when the server blocks its OpenID configuration', async () => {
      const responses = [
        new Response('', { status: 404 }),
        // A 404 without CORS headers fails the fetch
        new TypeError('Failed to fetch')
      ]
      const fetchFn = jest.fn(() => {
        const next = responses.shift()
        return next instanceof Response
          ? Promise.resolve(next)
          : Promise.reject(next ?? new Error('unexpected request'))
      })

      const completed = await completedOrThrow(
        makeConfig(OIDC_SOURCE),
        makeDependencies(fetchFn)
      )

      expect(completed.authMode).toBe('basic')
    })

    it.each([
      [
        '503 answers',
        [new Response('', { status: 503 }), new Response('', { status: 503 })]
      ],
      [
        'a network error',
        [new TypeError('Failed to fetch'), new Response('', { status: 404 })]
      ],
      [
        'an unavailable OpenID configuration',
        [new Response('', { status: 404 }), new Response('', { status: 502 })]
      ]
    ])(
      'is reported unreachable, not the Basic form, after %s',
      async (_name, responses) => {
        const queue = [...responses]
        const fetchFn = jest.fn(() => {
          const next = queue.shift() ?? new Error('unexpected request')
          return next instanceof Error
            ? Promise.reject(next)
            : Promise.resolve(next)
        })
        const dependencies = makeDependencies(fetchFn)

        const result = await completeConfig(
          makeConfig(OIDC_SOURCE),
          dependencies
        )

        expect(result).toEqual({ ok: false, error: 'sso-unreachable' })
        expect(dependencies.storage.data.size).toBe(0)
      }
    )

    it('still finds the server as an issuer when WebFinger is unavailable', async () => {
      const fetchFn = jest.fn((input: string | URL | Request) =>
        Promise.resolve(
          (input instanceof Request ? input.url : input.toString()).includes(
            'webfinger'
          )
            ? new Response('', { status: 503 })
            : Response.json({ issuer: 'https://jmap.example.com' })
        )
      )

      const completed = await completedOrThrow(
        makeConfig(OIDC_SOURCE),
        makeDependencies(fetchFn)
      )

      expect(completed.oidc?.issuerUrl).toBe('https://jmap.example.com')
    })

    it('is reported unreachable even when AUTH_MODE=oidc is explicit', async () => {
      const result = await completeConfig(
        makeConfig({ ...OIDC_SOURCE, AUTH_MODE: 'oidc' }),
        makeDependencies(
          jest.fn(() => Promise.resolve(new Response('', { status: 503 })))
        )
      )

      expect(result).toEqual({ ok: false, error: 'sso-unreachable' })
    })

    it('does not fall back when AUTH_MODE=oidc is explicit', async () => {
      const completed = await completedOrThrow(
        makeConfig({ ...OIDC_SOURCE, AUTH_MODE: 'oidc' }),
        makeDependencies(makeServerFetch({}))
      )

      expect(completed.authMode).toBe('oidc')
      expect(completed.oidc?.issuerUrl).toBe('https://jmap.example.com')
    })

    it('does not look for an SSO in basic mode', async () => {
      const fetchFn = makeServerFetch({})

      const completed = await completedOrThrow(
        makeConfig({ AUTH_MODE: 'basic' }),
        makeDependencies(fetchFn)
      )

      expect(completed.authMode).toBe('basic')
      expect(fetchFn).not.toHaveBeenCalled()
    })
  })
})
