import { act, screen, type RenderResult } from '@testing-library/react'

import { FLOATING_ACTION_INSET } from '@/ds/FloatingActionButton/FloatingActionButton'
import { resolveConfig } from '@common/config/config'
import { AppConfigProvider } from '@common/config/AppConfigProvider'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { FeedbackWidget } from './FeedbackWidget'

const mockIsInIframe = jest.fn<boolean, []>()
jest.mock('cozy-external-bridge', () => ({
  CozyBridge: jest.fn(() => ({ isInIframe: mockIsInIframe }))
}))

const mockStore = {
  isRunning: false,
  generation: 0,
  listeners: new Set<() => void>()
}

function setRunning(isRunning: boolean): void {
  if (isRunning) mockStore.generation += 1
  mockStore.isRunning = isRunning
  for (const listener of mockStore.listeners) listener()
}

const mockDetach = jest.fn()
const mockAttach = jest.fn(
  (_el: HTMLElement, _labels: Record<string, string>) => mockDetach
)
const mockSetTheme = jest.fn()

jest.mock('@common/app/sentry', () => ({
  sentryLifecycle: {
    subscribe: (listener: () => void): (() => void) => {
      mockStore.listeners.add(listener)
      return () => mockStore.listeners.delete(listener)
    },
    feedbackGeneration: (): number =>
      mockStore.isRunning ? mockStore.generation : 0,
    attachFeedback: (el: HTMLElement, labels: Record<string, string>) =>
      mockAttach(el, labels),
    setFeedbackTheme: (scheme: string): void => {
      mockSetTheme(scheme)
    }
  }
}))

function renderWidget({
  isEmbedded = false,
  hasBottomAction = false
}: { isEmbedded?: boolean; hasBottomAction?: boolean } = {}): RenderResult {
  mockIsInIframe.mockReturnValue(isEmbedded)
  const config = resolveConfig(
    {
      SERVER_URL: 'https://jmap.example.com',
      AUTH_MODE: 'basic',
      WORKPLACE_EMBEDDING: true
    },
    'https://mail.example.com'
  )
  if (!config.ok) throw new Error('Invalid configuration')
  return renderWithProviders(
    <AppConfigProvider config={config.value}>
      <FeedbackWidget hasBottomAction={hasBottomAction} />
    </AppConfigProvider>
  )
}

function queryButton(): HTMLElement | null {
  return screen.queryByTestId('twake-feedback-button')
}

describe('FeedbackWidget', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setRunning(false)
  })

  it('offers nothing while the feedback is not running', () => {
    renderWidget()

    expect(queryButton()).toBeNull()
    expect(mockAttach).not.toHaveBeenCalled()
  })

  it('mounts the shared button once the feedback runs, plugs the form on it with the labels of the language, and detaches it with the shell', () => {
    setRunning(true)
    const { unmount } = renderWidget()

    const button = queryButton()
    expect(button).not.toBeNull()
    expect(mockAttach).toHaveBeenCalledTimes(1)
    expect(mockAttach.mock.calls[0]?.[0]).toBe(button)
    const labels = mockAttach.mock.calls[0]?.[1] ?? {}
    expect(labels).toMatchObject({
      formTitle: 'Send feedback',
      submitButtonLabel: 'Send'
    })
    expect(mockSetTheme).toHaveBeenCalledWith('light')

    unmount()

    expect(mockDetach).toHaveBeenCalledTimes(1)
    expect(queryButton()).toBeNull()
  })

  it('follows the reporting: removed when it stops, back when it restarts', () => {
    renderWidget()

    act(() => {
      setRunning(true)
    })
    expect(queryButton()).not.toBeNull()

    act(() => {
      setRunning(false)
    })
    expect(queryButton()).toBeNull()
    expect(mockDetach).toHaveBeenCalledTimes(1)

    act(() => {
      setRunning(true)
    })
    expect(queryButton()).not.toBeNull()
    // Once per start: a render does not detach the form
    expect(mockAttach).toHaveBeenCalledTimes(2)
  })

  it('plugs itself on the new form when the reporting restarts without a render in between', () => {
    renderWidget()
    act(() => {
      setRunning(true)
    })
    expect(mockAttach).toHaveBeenCalledTimes(1)

    act(() => {
      setRunning(false)
      setRunning(true)
    })

    expect(queryButton()).not.toBeNull()
    expect(mockDetach).toHaveBeenCalledTimes(1)
    expect(mockAttach).toHaveBeenCalledTimes(2)
  })

  it('stays out of Twake Workplace, which owns the feedback there', () => {
    setRunning(true)
    renderWidget({ isEmbedded: true })

    expect(queryButton()).toBeNull()
    expect(mockAttach).not.toHaveBeenCalled()
  })

  it('keeps the corner, or rises above what the app shows at the bottom', () => {
    setRunning(true)
    const first = renderWidget()
    const lowest = Number.parseFloat(queryButton()?.style.bottom ?? '')
    first.unmount()

    renderWidget({ hasBottomAction: true })

    const raised = Number.parseFloat(queryButton()?.style.bottom ?? '')
    expect(raised - lowest).toBeGreaterThanOrEqual(FLOATING_ACTION_INSET - 16)
  })
})
