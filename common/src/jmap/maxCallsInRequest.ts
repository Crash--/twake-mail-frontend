/** Default `maxCallsInRequest` of a JMAP server (RFC 8620 suggests 16) */
const DEFAULT_MAX_CALLS = 16

/**
 * `maxCallsInRequest` of the session capabilities: the most method calls
 * one request may carry, 16 when the session does not tell
 */
export function maxCallsInRequest(
  capabilities: Record<string, unknown>
): number {
  const core = capabilities['urn:ietf:params:jmap:core']
  return typeof core === 'object' &&
    core !== null &&
    'maxCallsInRequest' in core &&
    typeof core.maxCallsInRequest === 'number'
    ? Math.max(1, core.maxCallsInRequest)
    : DEFAULT_MAX_CALLS
}
