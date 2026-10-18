import type { IdentitySummary } from './queries'

/**
 * The display name of an identity, null when it has none: blank, or its own
 * address (James names the identities it creates after their address). Where
 * a name is shown, the address stands in for it; it is never sent as one.
 */
export function identityDisplayName(
  identity: Pick<IdentitySummary, 'name' | 'email'>
): string | null {
  const name = identity.name.trim()
  if (name === '') return null
  return name.toLowerCase() === identity.email.trim().toLowerCase()
    ? null
    : name
}

/** How an identity reads in a list or a menu: its name, else its address */
export function identityLabel(
  identity: Pick<IdentitySummary, 'name' | 'email'>
): string {
  return identityDisplayName(identity) ?? identity.email
}

/** How the From field shows an identity: `Name <address>`, or the address */
export function identitySender(
  identity: Pick<IdentitySummary, 'name' | 'email'>
): string {
  const name = identityDisplayName(identity)
  return name === null ? identity.email : `${name} <${identity.email}>`
}
