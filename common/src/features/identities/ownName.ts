import { identityDisplayName } from './identityName'
import type { IdentitySummary } from './queries'

/**
 * The display name of the user (tmail-flutter#2756): the name of the first
 * identity sending from their own address (the session username), without
 * case; null when no such identity has a name (one named after its address
 * has none).
 */
export function ownName(
  identities: readonly Pick<IdentitySummary, 'name' | 'email'>[],
  username: string
): string | null {
  const address = username.trim().toLowerCase()
  const name = identities
    .filter(identity => identity.email.trim().toLowerCase() === address)
    .map(identityDisplayName)
    .find(candidate => candidate !== null)
  return name ?? null
}
