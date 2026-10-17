import type { Session } from 'jmap-client-ts'

import type { TranslationKey } from '@common/i18n/useI18n'

import type { ScribeMessage } from './scribePrompts'

/**
 * The AI assistant of the composer (tmail-flutter's "scribe"): offered when
 * the server advertises `com:linagora:params:jmap:aibot` with the URL of the
 * assistant (`scribeEndpoint`). Requests go there only, with the
 * credentials of the JMAP session, in the OpenAI chat format.
 */
export const AIBOT_CAPABILITY = 'com:linagora:params:jmap:aibot'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

/** An `https` URL, or `http` on the machine itself; null otherwise */
export function toSafeScribeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' ||
      (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))
      ? url.href
      : null
  } catch {
    return null
  }
}

function readEndpoint(capability: unknown): string | null {
  if (typeof capability !== 'object' || capability === null) return null
  const value =
    'scribeEndpoint' in capability ? capability.scribeEndpoint : null
  return typeof value === 'string' ? toSafeScribeUrl(value) : null
}

/**
 * The URL of the assistant, from the capability of the account (or of the
 * session), null when the server has none
 */
export function scribeEndpoint(
  session: Pick<Session, 'capabilities' | 'accounts'>,
  accountId: string
): string | null {
  return (
    readEndpoint(
      session.accounts[accountId]?.accountCapabilities[AIBOT_CAPABILITY]
    ) ?? readEndpoint(session.capabilities[AIBOT_CAPABILITY])
  )
}

export type ScribeCategory = 'correct' | 'improve' | 'tone' | 'translate'

export interface ScribeAction {
  id: string
  category: ScribeCategory
  label: TranslationKey
}

/**
 * The menu of tmail-flutter, in its order; the id of an action is the name
 * of its prompt (`scribePrompts.ts`)
 */
export const SCRIBE_ACTIONS: readonly ScribeAction[] = [
  {
    id: 'correct-grammar',
    category: 'correct',
    label: 'composer.scribe.correctGrammar'
  },
  {
    id: 'make-shorter',
    category: 'improve',
    label: 'composer.scribe.makeShorter'
  },
  {
    id: 'expand-context',
    category: 'improve',
    label: 'composer.scribe.expandContext'
  },
  {
    id: 'emojify',
    category: 'improve',
    label: 'composer.scribe.emojify'
  },
  {
    id: 'transform-to-bullets',
    category: 'improve',
    label: 'composer.scribe.transformToBullets'
  },
  {
    id: 'change-tone-professional',
    category: 'tone',
    label: 'composer.scribe.moreProfessional'
  },
  {
    id: 'change-tone-casual',
    category: 'tone',
    label: 'composer.scribe.moreCasual'
  },
  {
    id: 'change-tone-polite',
    category: 'tone',
    label: 'composer.scribe.morePolite'
  },
  {
    id: 'translate-french',
    category: 'translate',
    label: 'composer.scribe.french'
  },
  {
    id: 'translate-english',
    category: 'translate',
    label: 'composer.scribe.english'
  },
  {
    id: 'translate-russian',
    category: 'translate',
    label: 'composer.scribe.russian'
  },
  {
    id: 'translate-vietnamese',
    category: 'translate',
    label: 'composer.scribe.vietnamese'
  }
]

export type ScribeResult = { ok: true; value: string } | { ok: false }

/**
 * Asks the assistant (`POST scribeEndpoint`, `{ messages }`); its answer is
 * `choices[0].message.content` (OpenAI chat format), as tmail-flutter reads it.
 */
export async function askScribe(
  endpoint: string,
  messages: readonly ScribeMessage[],
  authorization: string | null,
  {
    signal,
    fetchFunction = fetch
  }: { signal?: AbortSignal; fetchFunction?: typeof fetch } = {}
): Promise<ScribeResult> {
  try {
    const response = await fetchFunction(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization === null ? {} : { Authorization: authorization })
      },
      body: JSON.stringify({ messages }),
      ...(signal ? { signal } : {})
    })
    if (!response.ok) return { ok: false }
    const json: unknown = await response.json()
    const choices =
      typeof json === 'object' && json !== null && 'choices' in json
        ? json.choices
        : null
    const first: unknown = Array.isArray(choices) ? choices[0] : null
    const message =
      typeof first === 'object' && first !== null && 'message' in first
        ? first.message
        : null
    const content =
      typeof message === 'object' && message !== null && 'content' in message
        ? message.content
        : null
    return typeof content === 'string' && content.trim() !== ''
      ? { ok: true, value: content.trim() }
      : { ok: false }
  } catch {
    return { ok: false }
  }
}
