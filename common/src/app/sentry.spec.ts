import * as Sentry from '@sentry/react'

import { makeRecorder, parseItems } from '@common/testing/sentryRecorder'

import {
  type SentryLifecycle,
  type SentryReporting,
  type SentrySetup
} from './sentry'

const SETUP: SentrySetup = {
  dsn: 'https://publickey@sentry.example.com/42',
  environment: 'test',
  release: '1.2.3',
  feedbackEnabled: false
}

const REPORTING: SentryReporting = { setup: SETUP, userId: 'a1b2c3d4e5f60718' }

// The SDK wraps the console once for the whole page, so the console is
// silenced once as well, not per test (`restoreMocks` would undo a spy)
const consoleMethods = { ...console }
beforeAll(() => {
  console.error = () => undefined
  console.warn = () => undefined
  console.info = () => undefined
})
afterAll(() => {
  Object.assign(console, consoleMethods)
})

describe('SentryLifecycle', () => {
  let lifecycle: SentryLifecycle
  let sent: string[]

  beforeEach(() => {
    ;({ lifecycle, sent } = makeRecorder())
  })

  afterEach(async () => {
    await lifecycle.apply(null)
  })

  it('has no client, so nothing to send, until the reporting is allowed', async () => {
    expect(lifecycle.isAllowed()).toBe(false)
    expect(lifecycle.isRunning()).toBe(false)
    expect(Sentry.getClient()).toBeUndefined()

    Sentry.captureException(new Error('before the consent'))
    console.error('[test] before the consent')
    await Sentry.flush(50)

    expect(sent).toEqual([])
  })

  it('reports once allowed, and stops sending as soon as it is not', async () => {
    await lifecycle.apply(REPORTING)
    expect(lifecycle.isRunning()).toBe(true)

    Sentry.captureException(new Error('first'))
    await Sentry.flush(500)
    expect(sent).toHaveLength(1)

    await lifecycle.apply(null)
    expect(lifecycle.isRunning()).toBe(false)
    Sentry.captureException(new Error('while it is off'))
    await Sentry.flush(50)

    expect(sent).toHaveLength(1)
  })

  it('stops allowing at once, before the SDK is closed', async () => {
    await lifecycle.apply(REPORTING)

    const stopping = lifecycle.apply(null)
    expect(lifecycle.isAllowed()).toBe(false)
    // The client still exists: only the gate keeps this one back
    Sentry.captureException(new Error('while closing'))
    await stopping

    expect(sent.join('')).not.toContain('while closing')
  })

  it('starts again after being turned off and on, with a fresh client', async () => {
    await lifecycle.apply(REPORTING)
    const first = Sentry.getClient()
    await lifecycle.apply(null)
    await lifecycle.apply(REPORTING)
    const second = Sentry.getClient()

    Sentry.captureException(new Error('second life'))
    await Sentry.flush(500)

    expect(second).not.toBe(first)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toContain('second life')
  })

  it('keeps only the last of a quick series of changes', async () => {
    const calls = [
      lifecycle.apply(REPORTING),
      lifecycle.apply(null),
      lifecycle.apply(REPORTING),
      lifecycle.apply(null)
    ]
    await Promise.all(calls)

    Sentry.captureException(new Error('after the series'))
    await Sentry.flush(50)

    expect(lifecycle.isRunning()).toBe(false)
    expect(sent).toEqual([])
  })

  it('restarts for another destination and moves to another user without restarting', async () => {
    await lifecycle.apply(REPORTING)
    const client = Sentry.getClient()

    await lifecycle.apply({ ...REPORTING, userId: 'another-account' })
    expect(Sentry.getClient()).toBe(client)
    expect(Sentry.getIsolationScope().getUser()).toEqual({
      id: 'another-account'
    })

    await lifecycle.apply({
      setup: { ...SETUP, environment: 'production' },
      userId: 'another-account'
    })
    expect(Sentry.getClient()).not.toBe(client)
  })

  it('forgets the user when it stops', async () => {
    await lifecycle.apply(REPORTING)
    Sentry.addBreadcrumb({ category: 'fetch', message: 'x' })
    await lifecycle.apply(null)

    expect(Sentry.getIsolationScope().getUser()?.id).toBeUndefined()
    expect(Sentry.getCurrentScope().getScopeData().breadcrumbs).toEqual([])
    expect(Sentry.getIsolationScope().getScopeData().breadcrumbs).toEqual([])
  })

  it('tags the events with the app, so that a shared DSN can tell them apart', async () => {
    await lifecycle.apply(REPORTING)
    Sentry.captureException(new Error('boom'))
    await Sentry.flush(500)

    const event = parseItems(sent[0] ?? '')[0]?.payload as {
      tags?: Record<string, string>
    }
    expect(event.tags).toEqual({ app: 'twake-mail' })
  })

  describe('what is sent', () => {
    async function capture(action: () => void): Promise<string> {
      await lifecycle.apply(REPORTING)
      action()
      await Sentry.flush(500)
      return sent.join('\n')
    }

    it('only sends error events, never sessions, replays, transactions or profiles', async () => {
      await capture(() => {
        Sentry.captureException(new Error('boom'))
      })

      const types = sent.flatMap(envelope =>
        parseItems(envelope).map(item => item.type)
      )
      expect(types).toEqual(['event'])
    })

    it('identifies the user by the pseudonym only', async () => {
      await capture(() => {
        Sentry.captureException(new Error('boom'))
      })

      const event = parseItems(sent[0] ?? '')[0]?.payload as {
        user?: Record<string, unknown>
        release?: string
        environment?: string
      }
      expect(event.user).toEqual({ id: REPORTING.userId })
      expect(event.release).toBe('1.2.3')
      expect(event.environment).toBe('test')
    })

    it('scrubs a JMAP error that carries email data', async () => {
      const error = new Error(
        'Email/get (c0) failed with invalidArguments: no such sender alice@example.com: "Salary review" access_token=abc123def'
      )
      error.name = 'JmapMethodError'
      const body = await capture(() => {
        Sentry.captureException(error, {
          extra: {
            subject: 'Salary review',
            preview: 'Hi Bob, the numbers are',
            from: [{ name: 'Alice', email: 'alice@example.com' }],
            textBody: 'secret text',
            blobId: 'G1234567890',
            attachments: [
              { name: 'payslip.pdf', blobId: 'Gabc', type: 'application/pdf' }
            ]
          }
        })
      })

      expect(body).not.toContain('alice@example.com')
      expect(body).not.toContain('Alice')
      expect(body).not.toContain('Salary review')
      expect(body).not.toContain('Hi Bob')
      expect(body).not.toContain('secret text')
      expect(body).not.toContain('payslip.pdf')
      expect(body).not.toContain('G1234567890')
      expect(body).not.toContain('abc123def')
      expect(body).toContain('JmapMethodError')
    })

    it('keeps the message of a console.error but not its arguments', async () => {
      const jmapObject = {
        subject: 'Private subject',
        from: [{ email: 'bob@example.com' }]
      }
      const body = await capture(() => {
        console.error('[rules] Cannot save the rule', jmapObject)
      })

      expect(body).toContain('[rules] Cannot save the rule')
      expect(body).not.toContain('Private subject')
      expect(body).not.toContain('bob@example.com')
    })

    it('does not send console warnings, logs, nor console breadcrumbs', async () => {
      const body = await capture(() => {
        console.warn('[auth] Token refresh failed', 'alice@example.com')
        console.info('mail from alice@example.com')
        Sentry.captureException(new Error('boom'))
      })

      expect(body).not.toContain('alice@example.com')
      expect(body).not.toContain('Token refresh failed')
      expect(body).not.toContain('"category":"console"')
    })

    it('scrubs the breadcrumb of a request that carried credentials', async () => {
      const body = await capture(() => {
        Sentry.addBreadcrumb({
          type: 'http',
          category: 'fetch',
          data: {
            url: 'https://jmap.example.com/download/acc123/blob456/payslip.pdf?access_token=zzz',
            method: 'GET',
            status_code: 200,
            headers: { Authorization: 'Bearer eyJhbGciOi.payload.signature' },
            request_body: '{"subject":"Salary review"}'
          }
        })
        Sentry.addBreadcrumb({
          category: 'ui.click',
          message:
            'button[aria-label="Unread, from alice@example.com, Salary review"]'
        })
        Sentry.addBreadcrumb({
          category: 'navigation',
          data: {
            from: '/mailbox/abc123/email/xyz789?q=salary',
            to: '/search?q=bob%40example.com'
          }
        })
        Sentry.captureException(new Error('boom'))
      })

      expect(body).toContain('/download/[Filtered]')
      expect(body).not.toContain('acc123')
      expect(body).not.toContain('payslip')
      expect(body).not.toContain('zzz')
      expect(body).not.toContain('Bearer')
      expect(body).not.toContain('eyJhbGciOi')
      expect(body).not.toContain('Salary')
      expect(body).not.toContain('aria-label')
      expect(body).not.toContain('abc123')
      expect(body).not.toContain('xyz789')
      expect(body).not.toContain('bob')
      expect(body).toContain('/mailbox/:id/email/:id')
    })

    it('drops the query string and the OIDC callback parameters of the page URL', async () => {
      const body = await capture(() => {
        Sentry.captureException(new Error('boom'), {
          contexts: {
            page: {
              url: 'https://mail.example.com/callback?code=AUTHCODE&state=STATE123&session_state=S',
              note: 'redirect to /callback?code=AUTHCODE&state=STATE123'
            }
          }
        })
      })

      expect(body).not.toContain('AUTHCODE')
      expect(body).not.toContain('STATE123')
    })

    it.each([
      ['a failed fetch', new TypeError('Failed to fetch')],
      ['an aborted request', new DOMException('aborted', 'AbortError')],
      [
        'a refused JMAP request',
        Object.assign(
          new Error('HTTP 401 Unauthorized on https://jmap.example.com/jmap'),
          {
            name: 'JmapHttpError',
            status: 401
          }
        )
      ],
      [
        'a JMAP server error',
        Object.assign(new Error('HTTP 503 on https://jmap.example.com/jmap'), {
          name: 'JmapHttpError',
          status: 503
        })
      ]
    ])('does not report %s', async (_label, error) => {
      await capture(() => {
        Sentry.captureException(error)
        console.error('[email] Attachment download failed', error)
      })

      expect(sent).toEqual([])
    })

    it('reports an unexpected error', async () => {
      await capture(() => {
        Sentry.captureException(new RangeError('Invalid array length'))
      })

      expect(sent).toHaveLength(1)
    })
  })
})
