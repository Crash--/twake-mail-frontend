import { assistantService, parseAssistantMessage } from './assistant'

const INTENT_ID = 'intent-1'

function message(kind: string, extra: Record<string, unknown> = {}): unknown {
  return { type: `intent-${INTENT_ID}:${kind}`, ...extra }
}

describe('assistantService', () => {
  it('is the page of the intent, and where it speaks from', () => {
    expect(
      assistantService({
        id: INTENT_ID,
        services: [{ href: 'https://alice-assistant.example.com/#/intents' }]
      })
    ).toEqual({
      intentId: INTENT_ID,
      href: 'https://alice-assistant.example.com/#/intents',
      origin: 'https://alice-assistant.example.com'
    })
  })

  it('is null for an intent without a service', () => {
    expect(assistantService({ id: INTENT_ID, services: [] })).toBe(null)
  })
})

describe('parseAssistantMessage', () => {
  it('reads the steps of the handshake', () => {
    expect(parseAssistantMessage(message('ready'), INTENT_ID)).toEqual({
      kind: 'ready'
    })
    expect(parseAssistantMessage(message('readyToUse'), INTENT_ID)).toEqual({
      kind: 'readyToUse'
    })
    expect(parseAssistantMessage(message('cancel'), INTENT_ID)).toEqual({
      kind: 'cancel'
    })
  })

  it('reads the call of a tool the LLM picked', () => {
    const data = message('result', {
      result: {
        tool: 'create_draft',
        params: { to: ['paul@example.com'], subject: '', body: 'Bonjour' }
      }
    })

    expect(parseAssistantMessage(data, INTENT_ID)).toEqual({
      kind: 'toolCall',
      call: {
        tool: 'create_draft',
        params: { to: ['paul@example.com'], subject: '', body: 'Bonjour' },
        text: null,
        messageId: null
      }
    })
  })

  it('reads the content of a tool with one', () => {
    const data = message('result', {
      result: {
        tool: 'write_report',
        params: { title: 'Report' },
        text: '# Report\n\nThe text',
        format: 'markdown'
      }
    })

    expect(parseAssistantMessage(data, INTENT_ID)).toEqual({
      kind: 'toolCall',
      call: {
        tool: 'write_report',
        params: { title: 'Report' },
        text: '# Report\n\nThe text',
        messageId: null
      }
    })
  })

  it('ignores the answer of an action button, since none is sent', () => {
    const data = message('result', {
      result: { answerAction: 'insert', text: 'Hello', format: 'markdown' }
    })

    expect(parseAssistantMessage(data, INTENT_ID)).toBe(null)
  })

  it('reads the numbers, the booleans and the unknown values of a call', () => {
    const data = message('result', {
      result: {
        tool: 'search_emails',
        params: { from: 'alae', limit: 10, unread: true, page: null }
      }
    })

    expect(parseAssistantMessage(data, INTENT_ID)).toEqual({
      kind: 'toolCall',
      call: {
        tool: 'search_emails',
        params: { from: 'alae', limit: 10, unread: true, page: null },
        text: null,
        messageId: null
      }
    })
  })

  it('reads the id of the message of a call, given back with its result', () => {
    const call = (messageId: unknown): unknown =>
      message('result', {
        result: { tool: 'list_emails', params: {}, messageId }
      })

    expect(parseAssistantMessage(call('m4'), INTENT_ID)).toMatchObject({
      call: { messageId: 'm4' }
    })
    expect(parseAssistantMessage(call(''), INTENT_ID)).toMatchObject({
      call: { messageId: null }
    })
    expect(parseAssistantMessage(call(4), INTENT_ID)).toMatchObject({
      call: { messageId: null }
    })
  })

  it('reads a call of an older assistant, under the former names', () => {
    const data = message('result', {
      result: { capability: 'list_emails', params: {}, callId: 'm4' }
    })

    expect(parseAssistantMessage(data, INTENT_ID)).toEqual({
      kind: 'toolCall',
      call: { tool: 'list_emails', params: {}, text: null, messageId: 'm4' }
    })
  })

  it('ignores a call with parameters the protocol does not send', () => {
    const call = (params: unknown): unknown =>
      message('result', { result: { tool: 'list_emails', params } })

    expect(parseAssistantMessage(call({ ids: [1, 'b'] }), INTENT_ID)).toBe(null)
    expect(
      parseAssistantMessage(call({ filter: { unread: true } }), INTENT_ID)
    ).toBe(null)
    expect(parseAssistantMessage(call({ limit: Infinity }), INTENT_ID)).toBe(
      null
    )
  })

  it('ignores the messages of another intent, and anything else', () => {
    expect(
      parseAssistantMessage({ type: 'intent-other:ready' }, INTENT_ID)
    ).toBe(null)
    expect(parseAssistantMessage(message('unknown'), INTENT_ID)).toBe(null)
    expect(parseAssistantMessage('ready', INTENT_ID)).toBe(null)
    expect(parseAssistantMessage(null, INTENT_ID)).toBe(null)
  })
})
