/** How much of the digest is kept: enough to tell accounts apart, no more */
const USER_ID_LENGTH = 16

/**
 * A pseudonym of the account for the reports: the start of the SHA-256 of
 * its JMAP account id, in hexadecimal. The same account always gets the same
 * one (to group its errors), nobody can get the account id nor an address
 * back from it, and it is never the address, the name nor the login.
 */
export async function makeSentryUserId(accountId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(accountId)
  )
  return Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, '0')
  )
    .join('')
    .slice(0, USER_ID_LENGTH)
}
