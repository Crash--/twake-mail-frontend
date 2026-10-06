import * as Sentry from '@sentry/react'

import { SentryLifecycle } from '@common/app/sentry'

/** The envelopes the SDK would post, as text */
export function makeRecorder(): {
  sent: string[]
  lifecycle: SentryLifecycle
} {
  const sent: string[] = []
  const lifecycle = new SentryLifecycle({
    transport: options =>
      Sentry.createTransport(options, request => {
        sent.push(
          typeof request.body === 'string'
            ? request.body
            : new TextDecoder().decode(request.body)
        )
        return Promise.resolve({ statusCode: 200 })
      })
  })
  return { sent, lifecycle }
}

/** The JSON of an item; null for a binary one (an attachment) */
function parsePayload(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/** The items of an envelope: [header, payload] pairs */
export function parseItems(
  envelope: string
): { type: string; payload: unknown }[] {
  const lines = envelope.split('\n').filter(line => line !== '')
  const items: { type: string; payload: unknown }[] = []
  for (let index = 1; index + 1 < lines.length; index += 2) {
    const header = JSON.parse(lines[index] ?? '{}') as { type: string }
    items.push({
      type: header.type,
      payload: parsePayload(lines[index + 1] ?? '{}')
    })
  }
  return items
}
