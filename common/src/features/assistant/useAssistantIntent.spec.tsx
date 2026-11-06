import { act, screen } from '@testing-library/react'
import type { ReactElement } from 'react'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import type {
  AssistantConfig,
  CapabilityCall,
  CapabilityResult
} from './assistant'
import { useAssistantIntent } from './useAssistantIntent'

const ASSISTANT_ORIGIN = 'https://alice-assistant.example.com'
const INTENT_ID = 'intent-1'

const CONFIG: AssistantConfig = {
  capabilities: [
    {
      name: 'create_draft',
      description: 'Create a draft',
      parameters: {
        type: 'object',
        properties: { body: { type: 'string' } },
        required: ['body']
      },
      confirm: true
    }
  ],
  capabilityResults: true,
  theme: { type: 'dark' }
}

function makeSdk(): { createIntent: jest.Mock } {
  return {
    createIntent: jest.fn(() =>
      Promise.resolve({
        id: INTENT_ID,
        services: [{ href: `${ASSISTANT_ORIGIN}/#/intents` }]
      })
    )
  }
}

interface ProbeProps {
  sdk: { createIntent: jest.Mock } | null
  config?: AssistantConfig | null
  onCall?: (call: CapabilityCall) => Promise<CapabilityResult | null>
  onCancel?: () => void
}

function Probe({
  sdk,
  config = CONFIG,
  onCall = jest.fn(() => Promise.resolve(null)),
  onCancel = jest.fn()
}: ProbeProps): ReactElement {
  const { state, frameRef } = useAssistantIntent(sdk, config, {
    onCall,
    onCancel
  })
  return (
    <>
      <p>
        {state.status}
        {state.status === 'open' && state.isReady ? ' ready' : ''}
      </p>
      {state.status === 'open' ? (
        <iframe ref={frameRef} title="assistant" />
      ) : null}
    </>
  )
}

function frameWindow(): Window {
  const frame = screen.getByTitle<HTMLIFrameElement>('assistant')
  if (frame.contentWindow === null) throw new Error('No frame window')
  return frame.contentWindow
}

function post(
  kind: string,
  extra: Record<string, unknown> = {},
  {
    origin = ASSISTANT_ORIGIN,
    source = frameWindow()
  }: { origin?: string; source?: Window } = {}
): void {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: `intent-${INTENT_ID}:${kind}`, ...extra },
        origin,
        source
      })
    )
  })
}

describe('useAssistantIntent', () => {
  it('opens the intent of the assistant', async () => {
    const sdk = makeSdk()

    renderWithProviders(<Probe sdk={sdk} />)

    expect(screen.getByText('opening')).toBeInTheDocument()
    expect(await screen.findByText('open')).toBeInTheDocument()
    expect(sdk.createIntent).toHaveBeenCalledWith({
      action: 'OPEN',
      type: 'io.cozy.ai.chat.conversations'
    })
  })

  it('waits for its configuration before opening', () => {
    const sdk = makeSdk()

    renderWithProviders(<Probe sdk={sdk} config={null} />)

    expect(screen.getByText('opening')).toBeInTheDocument()
    expect(sdk.createIntent).not.toHaveBeenCalled()
  })

  it('stays closed without the platform', () => {
    renderWithProviders(<Probe sdk={null} />)

    expect(screen.getByText('closed')).toBeInTheDocument()
  })

  it('fails when the platform refuses the intent', async () => {
    const sdk = makeSdk()
    sdk.createIntent.mockRejectedValue(new Error('403'))
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    renderWithProviders(<Probe sdk={sdk} />)

    expect(await screen.findByText('failed')).toBeInTheDocument()
  })

  it('sends the capabilities and the theme to the assistant when it is ready', async () => {
    renderWithProviders(<Probe sdk={makeSdk()} />)
    await screen.findByText('open')
    const postMessage = jest.spyOn(frameWindow(), 'postMessage')

    post('ready')

    expect(postMessage).toHaveBeenCalledWith(CONFIG, ASSISTANT_ORIGIN)
  })

  it('is ready once the assistant says so', async () => {
    renderWithProviders(<Probe sdk={makeSdk()} />)
    await screen.findByText('open')

    post('readyToUse')

    expect(screen.getByText('open ready')).toBeInTheDocument()
  })

  it('hands back the capability the LLM picked', async () => {
    const onCall = jest.fn(() => Promise.resolve(null))
    renderWithProviders(<Probe sdk={makeSdk()} onCall={onCall} />)
    await screen.findByText('open')

    post('result', {
      result: { capability: 'create_draft', params: { body: 'Bonjour' } }
    })

    expect(onCall).toHaveBeenCalledWith({
      capability: 'create_draft',
      params: { body: 'Bonjour' },
      text: null,
      callId: null
    })
  })

  it('gives the assistant the result of a call, with the whole configuration', async () => {
    const result = { callId: 'm4', ok: true, content: '{"emails":[]}' }
    const onCall = jest.fn(() => Promise.resolve(result))
    renderWithProviders(<Probe sdk={makeSdk()} onCall={onCall} />)
    await screen.findByText('open')
    const postMessage = jest.spyOn(frameWindow(), 'postMessage')

    post('result', {
      result: {
        capability: 'search_emails',
        params: { from: 'Claire' },
        callId: 'm4'
      }
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: `intent-${INTENT_ID}:data`,
        data: { ...CONFIG, capabilityResult: result }
      },
      ASSISTANT_ORIGIN
    )
  })

  it('gives the assistant nothing for a call without a result', async () => {
    renderWithProviders(<Probe sdk={makeSdk()} />)
    await screen.findByText('open')
    const postMessage = jest.spyOn(frameWindow(), 'postMessage')

    post('result', {
      result: { capability: 'create_draft', params: { body: 'Bonjour' } }
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(postMessage).not.toHaveBeenCalled()
  })

  it('tells when the user closes the assistant', async () => {
    const onCancel = jest.fn()
    renderWithProviders(<Probe sdk={makeSdk()} onCancel={onCancel} />)
    await screen.findByText('open')

    post('cancel')

    expect(onCancel).toHaveBeenCalled()
  })

  it('ignores the messages of another origin or another window', async () => {
    const onCall = jest.fn(() => Promise.resolve(null))
    renderWithProviders(<Probe sdk={makeSdk()} onCall={onCall} />)
    await screen.findByText('open')
    const result = {
      result: { capability: 'create_draft', params: { body: 'Bonjour' } }
    }

    post('result', result, { origin: 'https://evil.example.com' })
    post('result', result, { source: window })

    expect(onCall).not.toHaveBeenCalled()
  })
})
