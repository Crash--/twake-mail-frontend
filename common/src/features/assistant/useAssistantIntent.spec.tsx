import { act, screen } from '@testing-library/react'
import type { ReactElement } from 'react'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import type { CapabilityCall } from './assistant'
import type { AssistantTool } from './assistantTools'
import { useAssistantIntent } from './useAssistantIntent'

const ASSISTANT_ORIGIN = 'https://alice-assistant.example.com'
const INTENT_ID = 'intent-1'

const CAPABILITIES: AssistantTool[] = [
  {
    name: 'create_draft',
    description: 'Create a draft',
    parameters: {
      type: 'object',
      properties: { body: { type: 'string' } },
      required: ['body']
    }
  }
]

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
  capabilities?: AssistantTool[] | null
  onCall?: (call: CapabilityCall) => void
  onCancel?: () => void
}

function Probe({
  sdk,
  capabilities = CAPABILITIES,
  onCall = jest.fn(),
  onCancel = jest.fn()
}: ProbeProps): ReactElement {
  const { state, frameRef } = useAssistantIntent(sdk, capabilities, {
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

  it('waits for the capabilities before opening', () => {
    const sdk = makeSdk()

    renderWithProviders(<Probe sdk={sdk} capabilities={null} />)

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

  it('sends the capabilities to the assistant when it is ready', async () => {
    renderWithProviders(<Probe sdk={makeSdk()} />)
    await screen.findByText('open')
    const postMessage = jest.spyOn(frameWindow(), 'postMessage')

    post('ready')

    expect(postMessage).toHaveBeenCalledWith(
      { capabilities: CAPABILITIES },
      ASSISTANT_ORIGIN
    )
  })

  it('is ready once the assistant says so', async () => {
    renderWithProviders(<Probe sdk={makeSdk()} />)
    await screen.findByText('open')

    post('readyToUse')

    expect(screen.getByText('open ready')).toBeInTheDocument()
  })

  it('hands back the capability the LLM picked', async () => {
    const onCall = jest.fn()
    renderWithProviders(<Probe sdk={makeSdk()} onCall={onCall} />)
    await screen.findByText('open')

    post('result', {
      result: { capability: 'create_draft', params: { body: 'Bonjour' } }
    })

    expect(onCall).toHaveBeenCalledWith({
      capability: 'create_draft',
      params: { body: 'Bonjour' },
      text: null
    })
  })

  it('tells when the user closes the assistant', async () => {
    const onCancel = jest.fn()
    renderWithProviders(<Probe sdk={makeSdk()} onCancel={onCancel} />)
    await screen.findByText('open')

    post('cancel')

    expect(onCancel).toHaveBeenCalled()
  })

  it('ignores the messages of another origin or another window', async () => {
    const onCall = jest.fn()
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
