import {
  findIssuerByWebFinger,
  isOpenIdIssuer,
  ISSUER_REL
} from './issuerDiscovery'

const SERVER = 'https://jmap.example.com'

function urlOf(input: string | URL | Request): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

function makeFetch(
  ...responses: (Response | Error)[]
): jest.Mock<Promise<Response>, [string | URL | Request, RequestInit?]> {
  const queue = [...responses]
  return jest.fn((_input: string | URL | Request, _init?: RequestInit) => {
    const next = queue.shift() ?? new Error('unexpected request')
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  })
}

describe('findIssuerByWebFinger', () => {
  it('asks the server as tmail-flutter does, without credentials', async () => {
    const fetchFn = makeFetch(
      Response.json({
        subject: SERVER,
        links: [{ rel: ISSUER_REL, href: 'https://sso.example.com/realms/x' }]
      })
    )

    const issuer = await findIssuerByWebFinger(`${SERVER}/`, fetchFn)

    expect(issuer).toBe('https://sso.example.com/realms/x')
    const [input, init] = fetchFn.mock.calls[0] ?? ['', {}]
    const url = urlOf(input)
    const requested = new URL(url)
    expect(requested.origin + requested.pathname).toBe(
      `${SERVER}/.well-known/webfinger`
    )
    expect(requested.searchParams.get('resource')).toBe(SERVER)
    expect(requested.searchParams.get('rel')).toBe(ISSUER_REL)
    expect(init?.credentials).toBe('omit')
    expect(init?.headers).not.toHaveProperty('Authorization')
  })

  it('keeps the path of a server behind a prefix, the resource being its origin', async () => {
    const fetchFn = makeFetch(
      Response.json({
        links: [{ rel: ISSUER_REL, href: 'https://sso.example.com' }]
      })
    )

    await findIssuerByWebFinger(`${SERVER}/jmap-prefix/`, fetchFn)

    const url = urlOf(fetchFn.mock.calls[0]?.[0] ?? '')
    expect(new URL(url).pathname).toBe('/jmap-prefix/.well-known/webfinger')
    expect(new URL(url).searchParams.get('resource')).toBe(SERVER)
  })

  it('takes the link of the issuer relation among others', async () => {
    const fetchFn = makeFetch(
      Response.json({
        links: [
          {
            rel: 'http://example.com/other',
            href: 'https://other.example.com'
          },
          { rel: ISSUER_REL, href: 'https://sso.example.com/' }
        ]
      })
    )

    await expect(findIssuerByWebFinger(SERVER, fetchFn)).resolves.toBe(
      'https://sso.example.com'
    )
  })

  it('takes the first link when none has the relation, as tmail-flutter', async () => {
    const fetchFn = makeFetch(
      Response.json({ links: [{ rel: 'x', href: 'https://sso.example.com' }] })
    )

    await expect(findIssuerByWebFinger(SERVER, fetchFn)).resolves.toBe(
      'https://sso.example.com'
    )
  })

  it.each([
    ['an error status', new Response('', { status: 404 })],
    ['a body that is not JSON', new Response('<html>')],
    ['no link', Response.json({ subject: SERVER, links: [] })],
    ['a link without href', Response.json({ links: [{ rel: ISSUER_REL }] })],
    [
      'a javascript: href',
      Response.json({
        links: [{ rel: ISSUER_REL, href: 'javascript:alert(1)' }]
      })
    ],
    ['a network error', new TypeError('Failed to fetch')]
  ])('finds nothing after %s', async (_name, response) => {
    await expect(
      findIssuerByWebFinger(SERVER, makeFetch(response))
    ).resolves.toBe(null)
  })

  it('does not ask for a server that is not an http(s) URL', async () => {
    const fetchFn = makeFetch()

    await expect(findIssuerByWebFinger('ftp://x', fetchFn)).resolves.toBe(null)
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe('isOpenIdIssuer', () => {
  it('is true when the OpenID configuration answers', async () => {
    const fetchFn = makeFetch(Response.json({ issuer: SERVER }))

    await expect(isOpenIdIssuer(`${SERVER}/`, fetchFn)).resolves.toBe(true)
    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      `${SERVER}/.well-known/openid-configuration`
    )
  })

  it.each([
    new Response('', { status: 404 }),
    new Response('<html>'),
    Response.json({ foo: 1 }),
    new TypeError('offline')
  ])('is false otherwise', async response => {
    await expect(isOpenIdIssuer(SERVER, makeFetch(response))).resolves.toBe(
      false
    )
  })
})
