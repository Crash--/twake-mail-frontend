import { fetchEcosystem, parseEcosystem, type EcosystemAuth } from './ecosystem'

describe('parseEcosystem', () => {
  it('reads the templates, trimmed', () => {
    const ecosystem = parseEcosystem({
      paywallUrlTemplate: '  https://pay.domain.tld/{localPart}  ',
      workplaceFqdnFallback: '{localPart}.twake.linagora.com',
      scribePromptUrl: ' https://prompts.domain.tld/prompts.json ',
      sentry: { enabled: true }
    })

    expect(ecosystem).toMatchObject({
      paywallUrlTemplate: 'https://pay.domain.tld/{localPart}',
      workplaceFqdnFallbackTemplate: '{localPart}.twake.linagora.com',
      scribePromptUrl: 'https://prompts.domain.tld/prompts.json'
    })
    expect(ecosystem?.sentry).toMatchObject({ enabled: true })
    expect(ecosystem?.document.sentry).toEqual({ enabled: true })
  })

  it.each([
    ['blank', '   '],
    ['not a string', 12],
    ['an object', { url: 'https://x.tld' }],
    ['null', null]
  ])('ignores a template that is %s', (_name, value) => {
    expect(
      parseEcosystem({
        paywallUrlTemplate: value,
        workplaceFqdnFallback: value,
        scribePromptUrl: value
      })
    ).toMatchObject({
      paywallUrlTemplate: null,
      workplaceFqdnFallbackTemplate: null,
      scribePromptUrl: null
    })
  })

  it.each([[null], [[]], ['text'], [3]])(
    'is null for %j, which is not an object',
    document => {
      expect(parseEcosystem(document)).toBeNull()
    }
  )
})

describe('fetchEcosystem', () => {
  const fetchMock = jest.fn<
    ReturnType<typeof fetch>,
    Parameters<typeof fetch>
  >()

  const auth = {
    getAuthorizationHeader: jest.fn<Promise<string | null>, []>(),
    onUnauthorized: jest.fn<Promise<boolean>, []>()
  } satisfies EcosystemAuth

  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock
    auth.getAuthorizationHeader.mockReset().mockResolvedValue('Bearer token')
    auth.onUnauthorized.mockReset().mockResolvedValue(false)
  })

  function answer(body: string, status = 200): void {
    fetchMock.mockResolvedValue(new Response(body, { status }))
  }

  it('asks the document with the credentials of the user, without cookies nor referrer', async () => {
    answer('{"paywallUrlTemplate":"https://pay.domain.tld/"}')

    const ecosystem = await fetchEcosystem('https://jmap.tld/eco', auth)

    expect(ecosystem.paywallUrlTemplate).toBe('https://pay.domain.tld/')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://jmap.tld/eco',
      expect.objectContaining({
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer token'
        }
      })
    )
  })

  it('asks again once the credentials are renewed after a 401', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(
        new Response('{"scribePromptUrl":"https://prompts.tld/p.json"}')
      )
    auth.onUnauthorized.mockResolvedValue(true)
    auth.getAuthorizationHeader
      .mockResolvedValueOnce('Bearer old')
      .mockResolvedValueOnce('Bearer new')

    const ecosystem = await fetchEcosystem('https://jmap.tld/eco', auth)

    expect(ecosystem.scribePromptUrl).toBe('https://prompts.tld/p.json')
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://jmap.tld/eco',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer new' })
      })
    )
  })

  it('throws on a 401 the credentials cannot get past', async () => {
    answer('', 401)

    await expect(fetchEcosystem('https://jmap.tld/eco', auth)).rejects.toThrow(
      '401'
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws without asking when the user is signed out', async () => {
    auth.getAuthorizationHeader.mockResolvedValue(null)

    await expect(fetchEcosystem('https://jmap.tld/eco', auth)).rejects.toThrow(
      'No credentials'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws when the server has none', async () => {
    answer('Not found', 404)

    await expect(fetchEcosystem('https://jmap.tld/eco', auth)).rejects.toThrow(
      '404'
    )
  })

  it('throws on a document that is not an object', async () => {
    answer('[1, 2]')

    await expect(fetchEcosystem('https://jmap.tld/eco', auth)).rejects.toThrow(
      'not an object'
    )
  })

  it('throws on a document that is not JSON', async () => {
    answer('<html></html>')

    await expect(fetchEcosystem('https://jmap.tld/eco', auth)).rejects.toThrow()
  })

  it('throws on a document too big to be one', async () => {
    answer(JSON.stringify({ filler: 'x'.repeat(70_000) }))

    await expect(fetchEcosystem('https://jmap.tld/eco', auth)).rejects.toThrow(
      'too big'
    )
  })
})
