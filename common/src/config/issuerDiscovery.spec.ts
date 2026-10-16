import {
  findIssuerByWebFinger,
  isOpenIdIssuer,
  ISSUER_REL
} from './issuerDiscovery'

const SERVER = 'https://jmap.example.com'
const ABSENT = { ok: false, error: 'absent' }
const UNAVAILABLE = { ok: false, error: 'unavailable' }

function urlOf(input: string | URL | Request): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

/** A page reached through redirections: the login of an auth proxy */
function redirected(body: string): Response {
  return Object.defineProperty(new Response(body), 'redirected', {
    value: true
  })
}

function htmlPage(): Response {
  return new Response('<html>', {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
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

    expect(issuer).toEqual({
      ok: true,
      value: 'https://sso.example.com/realms/x'
    })
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

    await expect(findIssuerByWebFinger(SERVER, fetchFn)).resolves.toEqual({
      ok: true,
      value: 'https://sso.example.com'
    })
  })

  it('takes the first link when none has the relation, as tmail-flutter', async () => {
    const fetchFn = makeFetch(
      Response.json({ links: [{ rel: 'x', href: 'https://sso.example.com' }] })
    )

    await expect(findIssuerByWebFinger(SERVER, fetchFn)).resolves.toEqual({
      ok: true,
      value: 'https://sso.example.com'
    })
  })

  it('reads the document it was redirected to (RFC 7033 §4.2)', async () => {
    const fetchFn = makeFetch(
      redirected(
        JSON.stringify({
          links: [{ rel: ISSUER_REL, href: 'https://sso.example.com' }]
        })
      )
    )

    await expect(findIssuerByWebFinger(SERVER, fetchFn)).resolves.toEqual({
      ok: true,
      value: 'https://sso.example.com'
    })
  })

  it.each([
    ['a 404 status', new Response('', { status: 404 })],
    ['a 410 status', new Response('', { status: 410 })],
    ['a body that is not JSON', new Response('<html>')],
    ['no link', Response.json({ subject: SERVER, links: [] })],
    ['a link without href', Response.json({ links: [{ rel: ISSUER_REL }] })],
    [
      'a javascript: href',
      Response.json({
        links: [{ rel: ISSUER_REL, href: 'javascript:alert(1)' }]
      })
    ]
  ])('finds none after %s', async (_name, response) => {
    await expect(
      findIssuerByWebFinger(SERVER, makeFetch(response))
    ).resolves.toEqual(ABSENT)
  })

  it.each([
    ['a 503 status', new Response('', { status: 503 })],
    ['a 500 status', new Response('', { status: 500 })],
    // An expired session in front of the SSO (tf#4794)
    ['a 401 status', new Response('', { status: 401 })],
    ['a 403 status', new Response('', { status: 403 })],
    ['a 408 status', new Response('', { status: 408 })],
    ['a 429 status', new Response('', { status: 429 })],
    ['a login page it was redirected to', redirected('<form>')],
    ['an HTML page', htmlPage()],
    ['a network error', new TypeError('Failed to fetch')],
    [
      'a timeout',
      Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    ]
  ])('is unavailable after %s', async (_name, response) => {
    await expect(
      findIssuerByWebFinger(SERVER, makeFetch(response))
    ).resolves.toEqual(UNAVAILABLE)
  })

  it('is unavailable when the body is cut off', async () => {
    const response = new Response('{}')
    jest
      .spyOn(response, 'json')
      .mockRejectedValue(
        Object.assign(new Error('timed out'), { name: 'TimeoutError' })
      )

    await expect(
      findIssuerByWebFinger(SERVER, makeFetch(response))
    ).resolves.toEqual(UNAVAILABLE)
  })

  it('does not ask for a server that is not an http(s) URL', async () => {
    const fetchFn = makeFetch()

    await expect(findIssuerByWebFinger('ftp://x', fetchFn)).resolves.toEqual(
      ABSENT
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe('isOpenIdIssuer', () => {
  it('is true when the OpenID configuration answers', async () => {
    const fetchFn = makeFetch(Response.json({ issuer: SERVER }))

    await expect(isOpenIdIssuer(`${SERVER}/`, fetchFn)).resolves.toEqual({
      ok: true,
      value: true
    })
    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      `${SERVER}/.well-known/openid-configuration`
    )
  })

  it('is true when the OpenID configuration answers after a redirection', async () => {
    const fetchFn = makeFetch(redirected(JSON.stringify({ issuer: SERVER })))

    await expect(isOpenIdIssuer(SERVER, fetchFn)).resolves.toEqual({
      ok: true,
      value: true
    })
  })

  it.each([
    new Response('', { status: 404 }),
    new Response('<html>'),
    Response.json({ foo: 1 }),
    // A 404 without CORS headers fails the fetch
    new TypeError('Failed to fetch')
  ])('is absent otherwise', async response => {
    await expect(isOpenIdIssuer(SERVER, makeFetch(response))).resolves.toEqual(
      ABSENT
    )
  })

  it.each([
    new Response('', { status: 503 }),
    new Response('', { status: 401 }),
    new Response('', { status: 403 }),
    redirected('<form>'),
    htmlPage(),
    Object.assign(new Error('timed out'), { name: 'TimeoutError' })
  ])('is unavailable when the server does not answer', async response => {
    await expect(isOpenIdIssuer(SERVER, makeFetch(response))).resolves.toEqual(
      UNAVAILABLE
    )
  })
})
