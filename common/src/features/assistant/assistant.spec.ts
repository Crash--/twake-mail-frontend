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

  it('reads the call of a capability the LLM picked', () => {
    const data = message('result', {
      result: {
        capability: 'create_draft',
        params: { to: ['paul@example.com'], subject: '', body: 'Bonjour' }
      }
    })

    expect(parseAssistantMessage(data, INTENT_ID)).toEqual({
      kind: 'capabilityCall',
      call: {
        capability: 'create_draft',
        params: { to: ['paul@example.com'], subject: '', body: 'Bonjour' },
        text: null
      }
    })
  })

  it('reads the content of a capability with one', () => {
    const data = message('result', {
      result: {
        capability: 'write_report',
        params: { title: 'Report' },
        text: '# Report\n\nThe text',
        format: 'markdown'
      }
    })

    expect(parseAssistantMessage(data, INTENT_ID)).toEqual({
      kind: 'capabilityCall',
      call: {
        capability: 'write_report',
        params: { title: 'Report' },
        text: '# Report\n\nThe text'
      }
    })
  })

  it('ignores the answer of an action button, since none is sent', () => {
    const data = message('result', {
      result: { answerAction: 'insert', text: 'Hello', format: 'markdown' }
    })

    expect(parseAssistantMessage(data, INTENT_ID)).toBe(null)
  })

  it('ignores a call with parameters that are not strings', () => {
    const call = (params: unknown): unknown =>
      message('result', { result: { capability: 'list_emails', params } })

    expect(parseAssistantMessage(call({ limit: 10 }), INTENT_ID)).toBe(null)
    expect(parseAssistantMessage(call({ ids: [1, 'b'] }), INTENT_ID)).toBe(null)
    expect(parseAssistantMessage(call({ limit: null }), INTENT_ID)).toBe(null)
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
