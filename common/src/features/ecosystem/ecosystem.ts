import { queryOptions } from '@tanstack/react-query'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'

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
  /** The whole document, for the features that read another section */
  document: Readonly<Record<string, unknown>>
}

export type EcosystemKey = ['ecosystem', string]

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
    document
  }
}

/**
 * The ecosystem document of the server. Asked without credentials nor
 * referrer: it is public information, and nothing of the user goes with the
 * request. Throws when the server serves none.
 */
export async function fetchEcosystem(
  url: string,
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
    const response = await fetch(url, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })
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
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

/** The document is the same for every account of the server */
export function ecosystemQueryOptions(
  url: string
): QueryOptionsFor<LinagoraEcosystem, EcosystemKey> {
  return queryOptions({
    queryKey: ['ecosystem', url],
    queryFn: ({ signal }) => fetchEcosystem(url, signal),
    staleTime: 60 * 60_000,
    // tmail-flutter never retries it
    retry: false
  })
}
