import {
  actionMessages,
  askScribe,
  SCRIBE_ACTIONS,
  scribeEndpoint,
  writingMessages
} from './scribe'
import { editorText, suggestionHtml } from './scribeText'

const SESSION = {
  capabilities: {},
  accounts: {
    a1: {
      name: 'alice',
      isPersonal: true,
      isReadOnly: false,
      accountCapabilities: {
        'com:linagora:params:jmap:aibot': {
          scribeEndpoint: 'https://ai.example.com/chat/completions'
        }
      }
    }
  }
}

describe('scribe', () => {
  it('reads the URL of the assistant from the aibot capability', () => {
    expect(scribeEndpoint(SESSION, 'a1')).toBe(
      'https://ai.example.com/chat/completions'
    )
    expect(scribeEndpoint({ capabilities: {}, accounts: {} }, 'a1')).toBe(null)
    expect(
      scribeEndpoint(
        {
          capabilities: {
            'com:linagora:params:jmap:aibot': {
              scribeEndpoint: 'http://ai.example.com/'
            }
          },
          accounts: {}
        },
        'a1'
      )
    ).toBe(null)
  })

  it('offers the actions of tmail-flutter with its prompts', () => {
    expect(SCRIBE_ACTIONS.map(action => action.id)).toEqual([
      'correct-grammar',
      'make-shorter',
      'expand-context',
      'emojify',
      'transform-to-bullets',
      'change-tone-professional',
      'change-tone-casual',
      'change-tone-polite',
      'translate-french',
      'translate-english',
      'translate-russian',
      'translate-vietnamese'
    ])
    const [system, user] = actionMessages(
      { instruction: 'Translate the text to French.' },
      'Hello'
    )
    expect(system?.content).toContain(
      'You are a text editing assistant, NOT a chatbot.'
    )
    expect(user).toEqual({
      role: 'user',
      content: 'INSTRUCTION:\nTranslate the text to French.\n\nTEXT:\nHello\n'
    })
    expect(writingMessages('Thank Bob', '')[1]?.content).toBe(
      'INSTRUCTION:\nThank Bob\n\nTEXT:\n'
    )
  })

  it('reads the answer of the assistant, with the JMAP credentials', async () => {
    const fetchFunction = jest.fn((..._args: Parameters<typeof fetch>) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: ' Bonjour ' } }]
          }),
          { status: 200 }
        )
      )
    )

    await expect(
      askScribe(
        'https://ai.example.com/chat',
        [{ role: 'user', content: 'Hello' }],
        'Bearer t',
        {
          fetchFunction
        }
      )
    ).resolves.toEqual({ ok: true, value: 'Bonjour' })
    const [, init] = fetchFunction.mock.calls[0] ?? []
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer t')
    await expect(
      askScribe('https://ai.example.com/chat', [], null, {
        fetchFunction: () =>
          Promise.resolve(new Response('{}', { status: 500 }))
      })
    ).resolves.toEqual({ ok: false })
  })

  it('reads what the user wrote, and writes the answer back as text', () => {
    expect(
      editorText(
        '<p>Hello Bob,</p><ul><li><p>one</p></li></ul><div data-html-block="quote"><p>quoted</p></div><div data-html-block="signature">Alice</div>'
      )
    ).toBe('Hello Bob,\n- one')
    expect(suggestionHtml('Line <1>\nLine 2')).toBe(
      '<p>Line &lt;1&gt;</p><p>Line 2</p>'
    )
  })
})
