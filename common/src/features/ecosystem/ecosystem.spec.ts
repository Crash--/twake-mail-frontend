import { fetchEcosystem, parseEcosystem } from './ecosystem'

describe('parseEcosystem', () => {
  it('reads the templates, trimmed', () => {
    const ecosystem = parseEcosystem({
      paywallUrlTemplate: '  https://pay.domain.tld/{localPart}  ',
      workplaceFqdnFallback: '{localPart}.twake.linagora.com',
      sentry: { enabled: true }
    })

    expect(ecosystem).toMatchObject({
      paywallUrlTemplate: 'https://pay.domain.tld/{localPart}',
      workplaceFqdnFallbackTemplate: '{localPart}.twake.linagora.com'
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
        workplaceFqdnFallback: value
      })
    ).toMatchObject({
      paywallUrlTemplate: null,
      workplaceFqdnFallbackTemplate: null
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

  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock
  })

  function answer(body: string, status = 200): void {
    fetchMock.mockResolvedValue(new Response(body, { status }))
  }

  it('asks the document without credentials nor referrer', async () => {
    answer('{"paywallUrlTemplate":"https://pay.domain.tld/"}')

    const ecosystem = await fetchEcosystem('https://jmap.tld/eco')

    expect(ecosystem.paywallUrlTemplate).toBe('https://pay.domain.tld/')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://jmap.tld/eco',
      expect.objectContaining({
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { Accept: 'application/json' }
      })
    )
  })

  it('throws when the server has none', async () => {
    answer('Not found', 404)

    await expect(fetchEcosystem('https://jmap.tld/eco')).rejects.toThrow('404')
  })

  it('throws on a document that is not an object', async () => {
    answer('[1, 2]')

    await expect(fetchEcosystem('https://jmap.tld/eco')).rejects.toThrow(
      'not an object'
    )
  })

  it('throws on a document that is not JSON', async () => {
    answer('<html></html>')

    await expect(fetchEcosystem('https://jmap.tld/eco')).rejects.toThrow()
  })

  it('throws on a document too big to be one', async () => {
    answer(JSON.stringify({ filler: 'x'.repeat(70_000) }))

    await expect(fetchEcosystem('https://jmap.tld/eco')).rejects.toThrow(
      'too big'
    )
  })
})
