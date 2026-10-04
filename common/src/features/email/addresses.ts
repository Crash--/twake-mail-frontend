import type { EmailAddress } from 'jmap-client-ts'

/** The name of an address, or the address itself when it has none */
export function formatAddressName(address: EmailAddress): string {
  const name = address.name?.trim() ?? ''
  return name === '' ? address.email : name
}

/** `Name <address>`, or the bare address when it has no name */
export function formatAddress(address: EmailAddress): string {
  const name = address.name?.trim()
  return name ? `${name} <${address.email}>` : address.email
}

/** The names of a list of addresses, comma separated */
export function formatAddressNames(
  addresses: readonly EmailAddress[] | null
): string {
  return (addresses ?? []).map(formatAddressName).join(', ')
}
