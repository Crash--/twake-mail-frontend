import {
  BUILT_IN_PROMPTS,
  fetchScribePrompts,
  parseScribePrompts,
  promptMessages,
  readScribePromptUrl,
  ScribePromptsError
} from './scribePrompts'

const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
const originalFetch = globalThis.fetch

beforeEach(() => {
  fetchMock.mockReset()
  globalThis.fetch = fetchMock
})

afterAll(() => {
  globalThis.fetch = originalFetch
})

describe('parseScribePrompts', () => {
  it('reads the prompts of the tmail-flutter format', () => {
    const prompts = parseScribePrompts({
      generatedAt: '2026-01-29T12:45:46.789Z',
      prompts: [
        {
          name: 'emojify',
          version: '1.0.0',
          messages: [
            { role: 'system', content: 'System' },
            { role: 'user', content: 'Emojify {{input}}' }
          ]
        }
      ]
    })

    expect(prompts?.get('emojify')).toEqual([
      { role: 'system', content: 'System' },
      { role: 'user', content: 'Emojify {{input}}' }
    ])
  })

  it('leaves out the prompts of another shape', () => {
    const prompts = parseScribePrompts({
      prompts: [
        { messages: [{ role: 'user', content: 'No name' }] },
        { name: 'empty', messages: [] },
        { name: 'assistant', messages: [{ role: 'assistant', content: 'x' }] },
        { name: 'number', messages: [{ role: 'user', content: 3 }] },
        'text'
      ]
    })

    expect(prompts?.size).toBe(0)
  })

  it.each([[null], [[]], [{}], [{ prompts: {} }]])(
    'is null for %j, which is not a prompts document',
    document => {
      expect(parseScribePrompts(document)).toBe(null)
    }
  )
})

describe('promptMessages', () => {
  const prompts = new Map([
    [
      'custom-prompt-mail',
      [
        { role: 'system' as const, content: 'Keep {{input}}' },
        { role: 'user' as const, content: 'Do {{ task }} on {{input}}' }
      ]
    ]
  ])

  it('replaces the placeholders of the user messages only, once', () => {
    expect(
      promptMessages(prompts, 'custom-prompt-mail', '{{task}} $&', 'thank')
    ).toEqual([
      { role: 'system', content: 'Keep {{input}}' },
      { role: 'user', content: 'Do thank on {{task}} $&' }
    ])
  })

  it('takes the built-in prompt the server does not give, null for none', () => {
    expect(promptMessages(prompts, 'emojify', 'Hi')?.[1]?.content).toBe(
      'INSTRUCTION:\nAdd emojis to the important parts of the text. Do not try to rephrase or replace text.\n\nTEXT:\nHi\n'
    )
    expect(promptMessages(BUILT_IN_PROMPTS, 'unknown', 'Hi')).toBe(null)
  })
})

describe('readScribePromptUrl', () => {
  it.each([
    ['https://prompts.tld/p.json', 'https://prompts.tld/p.json'],
    ['http://localhost:8000/p.json', 'http://localhost:8000/p.json'],
    ['http://prompts.tld/p.json', null],
    ['javascript:alert(1)', null],
    ['not a url', null],
    [null, null]
  ])('reads %j as %j', (value, expected) => {
    expect(readScribePromptUrl(value)).toBe(expected)
  })
})

describe('fetchScribePrompts', () => {
  it('asks without credentials nor referrer', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          prompts: [
            { name: 'emojify', messages: [{ role: 'user', content: 'x' }] }
          ]
        })
      )
    )

    const prompts = await fetchScribePrompts('https://prompts.tld/p.json')

    expect(prompts.has('emojify')).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://prompts.tld/p.json',
      expect.objectContaining({
        credentials: 'omit',
        referrerPolicy: 'no-referrer'
      })
    )
  })

  it.each([
    ['an error', new Response('Not found', { status: 404 })],
    ['no prompts', new Response('{}')],
    ['too big', new Response(' '.repeat(600_000))]
  ])('fails on %s', async (_name, response) => {
    fetchMock.mockResolvedValue(response)

    await expect(
      fetchScribePrompts('https://prompts.tld/p.json')
    ).rejects.toBeInstanceOf(ScribePromptsError)
  })
})
