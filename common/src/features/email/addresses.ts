import type { EmailAddress } from 'jmap-client-ts'

import {
  endOfRun,
  indexOfPattern,
  matchAllFrom
} from '@common/utils/linearMatch'

// An address written in a display name, as `ceo@bank.com` in
// `"ceo@bank.com" <x@evil.com>`
const ADDRESS_IN_NAME =
  /[^\s<>()[\]"',;:@]+@[^\s<>()[\]"',;:@]+\.[^\s<>()[\]"',;:@]+/y
const ADDRESS_CHAR = /[^\s<>()[\]"',;:@]/g
const ADDRESS_CHARS = /[^\s<>()[\]"',;:@]*/y

/**
 * The addresses written in a text. Linear (ReDoS): a match starts on an
 * address character, and when none starts there, none starts before the end
 * of its run of address characters (the local part of a match starting
 * later in the run would make one start there).
 */
function addressesIn(text: string): string[] {
  return matchAllFrom(text, ADDRESS_IN_NAME, {
    next: from => indexOfPattern(text, ADDRESS_CHAR, from),
    afterFailure: start => endOfRun(text, ADDRESS_CHARS, start)
  }).map(([found]) => found)
}

/**
 * Whether the display name holds another address than the real one, as
 * `"ceo@bank.com" <x@evil.com>`: showing it would pass the sender off as
 * someone else (tmail-flutter#977)
 */
function isSpoofingName(name: string, email: string): boolean {
  const realAddress = email.toLowerCase()
  return addressesIn(name).some(found => found.toLowerCase() !== realAddress)
}

/**
 * The display name of an address, trimmed, or `''` when it has none or when
 * it holds another address (the real address is shown instead)
 */
export function addressDisplayName(address: EmailAddress): string {
  const name = address.name?.trim() ?? ''
  return isSpoofingName(name, address.email) ? '' : name
}

/** The name of an address, or the address itself when it has none */
export function formatAddressName(address: EmailAddress): string {
  const name = addressDisplayName(address)
  return name === '' ? address.email : name
}

/** `Name <address>`, or the bare address when it has no name */
export function formatAddress(address: EmailAddress): string {
  const name = addressDisplayName(address)
  return name === '' ? address.email : `${name} <${address.email}>`
}

/** The names of a list of addresses, comma separated */
export function formatAddressNames(
  addresses: readonly EmailAddress[] | null
): string {
  return (addresses ?? []).map(formatAddressName).join(', ')
}
