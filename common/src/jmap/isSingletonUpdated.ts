/**
 * Whether a `Foo/set` response updated the `singleton` object. tmail-backend
 * leaves `updated` out (instead of `null`) when it refused the change, the
 * reason being in `notUpdated`.
 */
export function isSingletonUpdated(response: {
  updated: Record<string, unknown> | null
}): boolean {
  return response.updated?.singleton !== undefined
}
