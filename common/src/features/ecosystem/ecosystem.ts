import { queryOptions } from '@tanstack/react-query'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'
import type { AuthServiceBase } from '@common/features/auth/types'

import { parseEcosystemSentry, type EcosystemSentry } from './sentrySection'

/**
 * The Linagora ecosystem document of the server
 * (`.well-known/linagora-ecosystem`, as tmail-flutter reads it): the URL
 * sections the features of the Twake platform need (the paywall, the
 * Workplace, error reporting), fetched once and cached for all of them. A
 * feature adds its own property here.
 */
export interface LinagoraEcosystem {
  /** `paywallUrlTemplate`: where to buy more storage */
  paywallUrlTemplate: string | null
  /** `workplaceFqdnFallback`: the Workplace of a user without a claim */
  workplaceFqdnFallbackTemplate: string | null
  /** The `sentry` section: error reporting of the deployment */
  sentry: EcosystemSentry | null
  /** `scribePromptUrl`: the prompts of the AI assistant */
  scribePromptUrl: string | null
  /** The whole document, for the features that read another section */
  document: Readonly<Record<string, unknown>>
}

export type EcosystemKey = ['ecosystem', string]

/** The credentials of the user: the server answers 401 without them */
export type EcosystemAuth = Pick<
  AuthServiceBase,
  'getAuthorizationHeader' | 'onUnauthorized'
>

const ECOSYSTEM_TIMEOUT = 5_000

/** The document is a few lines: anything bigger is not what it should be */
const MAX_ECOSYSTEM_LENGTH = 64_000

export class EcosystemError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EcosystemError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A string property, trimmed; null when absent, blank or not a string */
function toTemplate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** Reads the ecosystem document; null when it is not an object */
export function parseEcosystem(document: unknown): LinagoraEcosystem | null {
  if (!isRecord(document)) return null
  return {
    paywallUrlTemplate: toTemplate(document.paywallUrlTemplate),
    workplaceFqdnFallbackTemplate: toTemplate(document.workplaceFqdnFallback),
    sentry: parseEcosystemSentry(document),
    scribePromptUrl: toTemplate(document.scribePromptUrl),
    document
  }
}

async function requestEcosystem(
  url: string,
  authorization: string,
  signal: AbortSignal
): Promise<Response> {
  return fetch(url, {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { Accept: 'application/json', Authorization: authorization },
    signal
  })
}

async function readEcosystem(response: Response): Promise<LinagoraEcosystem> {
  if (!response.ok) {
    throw new EcosystemError(`The ecosystem answered ${response.status}`)
  }
  const text = await response.text()
  if (text.length > MAX_ECOSYSTEM_LENGTH) {
    throw new EcosystemError('The ecosystem document is too big')
  }
  const ecosystem = parseEcosystem(JSON.parse(text))
  if (ecosystem === null) {
    throw new EcosystemError('The ecosystem document is not an object')
  }
  return ecosystem
}

/**
 * The ecosystem document of the server. The server serves it to signed-in
 * users only: asked with their credentials, renewed once on a 401 as the
 * JMAP client does, but without cookies nor referrer. Throws when the server
 * serves none, or the user is signed out.
 */
export async function fetchEcosystem(
  url: string,
  auth: EcosystemAuth,
  signal?: AbortSignal
): Promise<LinagoraEcosystem> {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, ECOSYSTEM_TIMEOUT)
  const abort = (): void => {
    controller.abort()
  }
  signal?.addEventListener('abort', abort)
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const authorization = await auth.getAuthorizationHeader()
      if (authorization === null) {
        throw new EcosystemError('No credentials to ask the ecosystem')
      }
      const response = await requestEcosystem(
        url,
        authorization,
        controller.signal
      )
      if (
        response.status === 401 &&
        attempt === 0 &&
        (await auth.onUnauthorized())
      ) {
        continue
      }
      return await readEcosystem(response)
    }
    throw new EcosystemError('The ecosystem answered 401')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

/** The document is the same for every account of the server */
export function ecosystemQueryOptions(
  url: string,
  auth: EcosystemAuth
): QueryOptionsFor<LinagoraEcosystem, EcosystemKey> {
  // auth only signs the request: the cache is cleared with the session
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryKey: ['ecosystem', url],
    queryFn: ({ signal }) => fetchEcosystem(url, auth, signal),
    staleTime: 60 * 60_000,
    // tmail-flutter never retries it
    retry: false
  })
}
