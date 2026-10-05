/**
 * The SaaS capability of tmail-backend (`com:linagora:params:saas`); the
 * library has no constant for it yet
 */
export const SAAS_CAPABILITY = 'com:linagora:params:saas'

/** What of the JMAP session the capability is read from */
export interface SaasCapabilitySource {
  capabilities: Readonly<Record<string, unknown>>
  accounts: Readonly<
    Record<
      string,
      { accountCapabilities: Readonly<Record<string, unknown>> } | undefined
    >
  >
}

/** What the server says of the subscription of the account */
export interface SaasCapability {
  isPaying: boolean
  canUpgrade: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Absent flags are false; a flag that is not a boolean spoils the whole capability */
function readFlag(value: unknown): boolean | null {
  if (value === undefined) return false
  return typeof value === 'boolean' ? value : null
}

export function parseSaasCapability(value: unknown): SaasCapability | null {
  if (!isRecord(value)) return null
  const isPaying = readFlag(value.isPaying)
  const canUpgrade = readFlag(value.canUpgrade)
  return isPaying === null || canUpgrade === null
    ? null
    : { isPaying, canUpgrade }
}

/**
 * The SaaS capability of the account (`getSaaSAccountCapability`): the one of
 * the account, else the one of the session; null without one
 */
export function readSaasCapability(
  session: SaasCapabilitySource,
  accountId: string
): SaasCapability | null {
  return parseSaasCapability(
    session.accounts[accountId]?.accountCapabilities[SAAS_CAPABILITY] ??
      session.capabilities[SAAS_CAPABILITY]
  )
}

/** Premium can be bought (`SaaSAccountCapability.isPremiumAvailable`) */
export function isPremiumAvailable(capability: SaasCapability | null): boolean {
  return capability?.canUpgrade === true
}

/** Already on the best plan (`isAlreadyHighestSubscription`) */
export function isAlreadyHighestSubscription(
  capability: SaasCapability | null
): boolean {
  return capability !== null && capability.isPaying && !capability.canUpgrade
}
