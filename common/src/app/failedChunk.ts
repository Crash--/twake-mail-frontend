import { requestVersionCheck } from '@linagora/twake-react-new-version'

/**
 * For the `catch` of a lazy import: a chunk that does not load is the usual
 * sign of a tab older than the served build, which is checked at once. The
 * import still fails as before.
 */
export function failedChunk(error: unknown): never {
  requestVersionCheck()
  throw error
}
