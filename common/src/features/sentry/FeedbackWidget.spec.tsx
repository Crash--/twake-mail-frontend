import { act, type RenderResult } from '@testing-library/react'

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
  listeners: new Set<() => void>()
}

function setRunning(isRunning: boolean): void {
  mockStore.isRunning = isRunning
  for (const listener of mockStore.listeners) listener()
}

jest.mock('@common/app/sentry', () => ({
  FEEDBACK_HOST_ID: 'sentry-feedback',
  sentryLifecycle: {
    subscribe: (listener: () => void): (() => void) => {
      mockStore.listeners.add(listener)
      return () => mockStore.listeners.delete(listener)
    },
    isFeedbackRunning: (): boolean => mockStore.isRunning
  }
}))

const mockRemoveFromDom = jest.fn()
const mockCreateWidget = jest.fn((_labels: Record<string, string>) => {
  const host = document.createElement('div')
  host.id = 'sentry-feedback'
  document.body.appendChild(host)
  return {
    removeFromDom: () => {
      mockRemoveFromDom()
      host.remove()
    }
  }
})
let mockHasFeedback = true

jest.mock('@sentry/react', () => ({
  getFeedback: () =>
    mockHasFeedback ? { createWidget: mockCreateWidget } : undefined
}))

function renderWidget({
  isEmbedded = false,
  hasFloatingAction = false
}: { isEmbedded?: boolean; hasFloatingAction?: boolean } = {}): RenderResult {
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
      <FeedbackWidget hasFloatingAction={hasFloatingAction} />
    </AppConfigProvider>
  )
}

function getHost(): HTMLElement | null {
  return document.getElementById('sentry-feedback')
}

describe('FeedbackWidget', () => {
  beforeEach(() => {
    mockHasFeedback = true
    setRunning(false)
  })

  it('offers nothing while the feedback is not running', () => {
    renderWidget()

    expect(mockCreateWidget).not.toHaveBeenCalled()
    expect(getHost()).toBeNull()
  })

  it('mounts the button once the feedback runs, with every label translated, and removes it with the shell', () => {
    setRunning(true)
    const { unmount } = renderWidget()

    expect(mockCreateWidget).toHaveBeenCalledTimes(1)
    const labels = mockCreateWidget.mock.calls[0]?.[0] ?? {}
    expect(labels).toMatchObject({
      triggerLabel: 'Send feedback',
      triggerAriaLabel: 'Send feedback',
      formTitle: 'Send feedback',
      emailLabel: 'Email (optional)',
      submitButtonLabel: 'Send',
      successMessageText: 'Thank you for your feedback!'
    })
    for (const value of Object.values(labels)) {
      expect(value.trim()).not.toBe('')
      // No missing key shown as its path
      expect(value).not.toMatch(/^feedback\./)
    }
    expect(getHost()).not.toBeNull()

    unmount()

    expect(mockRemoveFromDom).toHaveBeenCalledTimes(1)
    expect(getHost()).toBeNull()
  })

  it('follows the reporting: removed when it stops, back when it restarts', () => {
    renderWidget()

    act(() => {
      setRunning(true)
    })
    expect(getHost()).not.toBeNull()

    act(() => {
      setRunning(false)
    })
    expect(getHost()).toBeNull()

    act(() => {
      setRunning(true)
    })
    expect(getHost()).not.toBeNull()
    // Once per start: a stable `t` does not recreate the widget on a render
    expect(mockCreateWidget).toHaveBeenCalledTimes(2)
  })

  it('stays out of Twake Workplace, which owns the feedback there', () => {
    setRunning(true)
    renderWidget({ isEmbedded: true })

    expect(mockCreateWidget).not.toHaveBeenCalled()
    expect(getHost()).toBeNull()
  })

  it('does nothing when the SDK has no feedback integration', () => {
    mockHasFeedback = false
    setRunning(true)
    renderWidget()

    expect(mockCreateWidget).not.toHaveBeenCalled()
  })

  it('keeps the corner, or rises above the floating button of the app', () => {
    setRunning(true)
    const first = renderWidget()
    expect(getHost()?.style.getPropertyValue('--inset')).toBe('auto 0 0 auto')
    first.unmount()

    renderWidget({ hasFloatingAction: true })

    expect(getHost()?.style.getPropertyValue('--inset')).toContain('88px')
  })
})
