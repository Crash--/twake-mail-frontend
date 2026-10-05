/** The `sentry` section of the Linagora ecosystem document of the server */
export interface EcosystemSentry {
  /** Whether this deployment offers error reporting */
  enabled: boolean | null
  dsn: string | null
  environment: string | null
  /**
   * The starting position of the toggle of each user, not a master switch:
   * missing means off (tmail-flutter `userOptInByDefault`)
   */
  userOptInByDefault: boolean | null
}

/** A boolean, or `"true"`/`"false"` (tmail-flutter `_parseBool`); else null */
function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true'
  return null
}

function toText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Reads the `sentry` section of the ecosystem document; null when the
 * document has none, or is not an object.
 */
export function parseEcosystemSentry(
  document: unknown
): EcosystemSentry | null {
  if (!isRecord(document) || !isRecord(document.sentry)) return null
  const section = document.sentry
  return {
    enabled: toBoolean(section.enabled),
    dsn: toText(section.dsn),
    environment: toText(section.environment),
    userOptInByDefault: toBoolean(section.userOptInByDefault)
  }
}

/**
 * Whether a DSN given by the server is safe to send to: `https`, with the
 * public key and the project that make a DSN. The ones of the environment
 * configuration are the operator's and not checked here.
 */
export function isSafeEcosystemDsn(dsn: string): boolean {
  try {
    const url = new URL(dsn)
    return (
      url.protocol === 'https:' &&
      url.username !== '' &&
      url.password === '' &&
      url.hostname !== '' &&
      /^\/(?:[^/]+\/)*\d+$/.test(url.pathname)
    )
  } catch {
    return false
  }
}
