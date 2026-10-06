import * as Sentry from '@sentry/react'

import { makeRecorder, parseItems } from '@common/testing/sentryRecorder'

import type { SentryLifecycle, SentryReporting } from './sentry'

const REPORTING: SentryReporting = {
  setup: {
    dsn: 'https://publickey@sentry.example.com/42',
    environment: 'test',
    release: '1.2.3',
    feedbackEnabled: false
  },
  userId: 'a1b2c3d4e5f60718'
}

const WITH_FEEDBACK: SentryReporting = {
  ...REPORTING,
  setup: { ...REPORTING.setup, feedbackEnabled: true }
}

const consoleMethods = { ...console }
beforeAll(() => {
  console.error = () => undefined
  console.warn = () => undefined
  console.info = () => undefined
})
afterAll(() => {
  Object.assign(console, consoleMethods)
})

describe('SentryLifecycle, user feedback', () => {
  let lifecycle: SentryLifecycle
  let sent: string[]

  beforeEach(() => {
    ;({ lifecycle, sent } = makeRecorder())
  })

  afterEach(async () => {
    await lifecycle.apply(null)
  })

  const SCREENSHOT = {
    filename: 'screenshot.png',
    data: new Uint8Array([137, 80, 78, 71])
  }

  async function sendFeedback(
    params: Parameters<typeof Sentry.captureFeedback>[0]
  ): Promise<{ event: Record<string, unknown>; body: string }> {
    Sentry.captureFeedback(params, { attachments: [SCREENSHOT] })
    await Sentry.flush(500)
    const body = sent.join('\n')
    const item = sent
      .flatMap(parseItems)
      .find(candidate => candidate.type === 'feedback')
    return { event: (item?.payload ?? {}) as Record<string, unknown>, body }
  }

  it('adds no widget unless the deployment turns it on', async () => {
    await lifecycle.apply(REPORTING)

    expect(Sentry.getFeedback()).toBeUndefined()
    expect(document.getElementById('sentry-feedback')).toBeNull()
  })

  it('adds the widget, without any button of its own, when it is on', async () => {
    await lifecycle.apply(WITH_FEEDBACK)

    expect(Sentry.getFeedback()).toBeDefined()
    expect(document.getElementById('sentry-feedback')).toBeNull()
  })

  it('sends the message, the contact email and the screenshot as typed, and scrubs what the SDK adds', async () => {
    await lifecycle.apply(WITH_FEEDBACK)

    const { event, body } = await sendFeedback({
      message: 'The list is slow, write to me at carol@example.com',
      email: 'carol@example.com',
      url: 'https://mail.example.com/mailbox/abc123/email/xyz789?q=salary#frag',
      source: 'widget'
    })

    expect(event.type).toBe('feedback')
    expect(event.contexts).toMatchObject({
      feedback: {
        message: 'The list is slow, write to me at carol@example.com',
        contact_email: 'carol@example.com',
        url: 'https://mail.example.com/mailbox/:id/email/:id',
        source: 'widget'
      }
    })
    expect(event.tags).toEqual({ app: 'twake-mail' })
    expect(event.user).toEqual({ id: REPORTING.userId })
    expect(event.release).toBe('1.2.3')
    expect(event.environment).toBe('test')
    expect(body).toContain('"type":"attachment"')
    expect(body).toContain('"filename":"screenshot.png"')
    expect(body).not.toContain('abc123')
    expect(body).not.toContain('salary')
    expect(body).not.toContain('#frag')
  })

  it('leaves out the headers of the page, the extra data and the interaction breadcrumbs', async () => {
    await lifecycle.apply(WITH_FEEDBACK)
    Sentry.addBreadcrumb({
      category: 'ui.click',
      message: 'button[aria-label="Unread, from alice@example.com"]'
    })
    Sentry.addBreadcrumb({
      category: 'fetch',
      data: {
        url: 'https://jmap.example.com/download/acc123/blob456/payslip.pdf?access_token=zzz',
        method: 'GET',
        status_code: 200
      }
    })

    const { event, body } = await sendFeedback({
      message: 'Looks fine',
      url: 'https://mail.example.com/'
    })

    expect(event).not.toHaveProperty('request.headers')
    expect(body).not.toContain('Referer')
    expect(body).not.toContain('aria-label')
    expect(body).not.toContain('alice@example.com')
    expect(body).not.toContain('acc123')
    expect(body).not.toContain('payslip')
    expect(body).not.toContain('zzz')
  })

  it('is dropped as soon as the reporting is not allowed, like an error', async () => {
    await lifecycle.apply(WITH_FEEDBACK)

    const stopping = lifecycle.apply(null)
    Sentry.captureFeedback({ message: 'while closing' })
    await stopping

    expect(sent.join('')).not.toContain('while closing')
  })

  it('removes the widget with the client, so a restart does not add a second one', async () => {
    await lifecycle.apply(WITH_FEEDBACK)
    Sentry.getFeedback()?.createWidget()
    expect(document.querySelectorAll('#sentry-feedback')).toHaveLength(1)

    await lifecycle.apply(null)
    expect(document.getElementById('sentry-feedback')).toBeNull()

    await lifecycle.apply(WITH_FEEDBACK)
    Sentry.getFeedback()?.createWidget()
    expect(document.querySelectorAll('#sentry-feedback')).toHaveLength(1)
  })

  it('tells its subscribers when the feedback starts and stops', async () => {
    const listener = jest.fn()
    const unsubscribe = lifecycle.subscribe(listener)

    await lifecycle.apply(WITH_FEEDBACK)
    expect(lifecycle.isFeedbackRunning()).toBe(true)
    await lifecycle.apply(null)
    expect(lifecycle.isFeedbackRunning()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    await lifecycle.apply(REPORTING)
    expect(lifecycle.isFeedbackRunning()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('restarts the client when the flag changes', async () => {
    await lifecycle.apply(REPORTING)
    const client = Sentry.getClient()

    await lifecycle.apply(WITH_FEEDBACK)

    expect(Sentry.getClient()).not.toBe(client)
    expect(Sentry.getFeedback()).toBeDefined()
  })
})
