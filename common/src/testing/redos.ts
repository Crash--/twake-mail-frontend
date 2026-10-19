/**
 * Helpers of the ReDoS tests (`docs/security/redos-audit.md`): adversarial
 * inputs must be handled in a time linear in their length, and a rewritten
 * pattern must give what the original one gave.
 */

/**
 * The bound of a stress test: the inputs are 50 000 characters or more,
 * which the quadratic patterns took seconds to minutes to reject, and the
 * linear code a few milliseconds; generous for a loaded CI machine.
 */
export const STRESS_TIME_LIMIT_MS = 1000

/** The milliseconds `run` takes */
export function elapsedMs(run: () => unknown): number {
  const start = performance.now()
  run()
  return performance.now() - start
}

/**
 * Deterministic random texts made of `alphabet` (strings picked whole),
 * for the differential tests against the original patterns
 */
export function randomTexts(
  alphabet: readonly string[],
  { count = 2000, maxLength = 24, seed = 649 } = {}
): string[] {
  // mulberry32
  let state = seed
  const random = (): number => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  return Array.from({ length: count }, () => {
    const length = Math.floor(random() * (maxLength + 1))
    return Array.from(
      { length },
      () => alphabet[Math.floor(random() * alphabet.length)] ?? ''
    ).join('')
  })
}
