export type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown }

/**
 * Awaits one call of a JMAP request without throwing: the other calls of
 * the request stay readable when this one failed.
 */
export async function settle<T>(handle: PromiseLike<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await handle }
  } catch (error: unknown) {
    return { ok: false, error }
  }
}
