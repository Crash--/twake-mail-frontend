import type { EmailAddress } from 'jmap-client-ts'

import {
  formatRecipient,
  isValidEmail,
  parseRecipients
} from '@common/features/composer/recipients'
import { sanitizeSignature } from '@common/features/composer/signature'
import type { TranslationKey } from '@common/i18n/useI18n'

import type { IdentitySummary } from './queries'

/**
 * The `sortOrder` tmail-flutter gives to the default identity, and to the
 * others (`IdentityUtils`); James gives 100 to the identities it creates
 */
export const DEFAULT_SORT_ORDER = 0
export const OTHER_SORT_ORDER = 100

/** Attribute of tmail-flutter naming the PublicAsset of a signature image */
export const PUBLIC_ASSET_ATTRIBUTE = 'public-asset-id'
/** Attribute of the editor images keeping a reference (`InlineImage`) */
const EDITOR_REFERENCE_ATTRIBUTE = 'data-reference'

/** The problem with an identity name, as tmail-flutter validates it */
export function validateIdentityName(name: string): TranslationKey | null {
  if (name === '') return 'identities.errors.blank'
  if (name.trim() === '') return 'identities.errors.onlySpaces'
  return null
}

export type AddressesResult =
  { ok: true; value: EmailAddress[] } | { ok: false; invalid: string }

/**
 * The addresses of a Reply-To or Bcc field (`Name <address>` or bare,
 * separated by commas), or the first invalid one. Empty is `[]`, as
 * tmail-flutter sends it: James ignores a `null` in an update.
 */
export function parseIdentityAddresses(text: string): AddressesResult {
  const recipients = parseRecipients(text)
  const invalid = recipients.find(recipient => !isValidEmail(recipient.email))
  if (invalid) return { ok: false, invalid: invalid.email }
  return {
    ok: true,
    value: recipients.map(({ name, email }) => ({ name, email }))
  }
}

export function formatIdentityAddresses(
  addresses: readonly EmailAddress[] | null | undefined
): string {
  return (addresses ?? [])
    .map(address =>
      // James leaves out a null name
      formatRecipient({ name: address.name ?? null, email: address.email })
    )
    .join(', ')
}

/**
 * The addresses an identity can send from, as tmail-flutter offers them:
 * the emails of the existing identities (James creates one per alias),
 * and the address of the account
 */
export function allowedIdentityEmails(
  identities: readonly Pick<IdentitySummary, 'email'>[],
  username: string
): string[] {
  const emails: string[] = []
  for (const email of [
    username,
    ...identities.map(identity => identity.email)
  ]) {
    if (!emails.some(other => other.toLowerCase() === email.toLowerCase())) {
      emails.push(email)
    }
  }
  return emails
}

/** The identity used by default: the first one, once sorted */
export function defaultIdentityId(
  sortedIdentities: readonly Pick<IdentitySummary, 'id'>[]
): string | null {
  return sortedIdentities[0]?.id ?? null
}

/**
 * The `sortOrder` updates making `targetId` the default identity: 0 for it,
 * 100 for the others at 0 or below (the default ones of before), as
 * tmail-flutter does
 */
export function defaultSortOrderUpdates(
  identities: readonly Pick<IdentitySummary, 'id' | 'sortOrder'>[],
  targetId: string | null
): Record<string, { sortOrder: number }> {
  const updates: Record<string, { sortOrder: number }> = {}
  for (const identity of identities) {
    if (identity.id === targetId) continue
    if ((identity.sortOrder ?? OTHER_SORT_ORDER) <= DEFAULT_SORT_ORDER) {
      updates[identity.id] = { sortOrder: OTHER_SORT_ORDER }
    }
  }
  if (targetId !== null) updates[targetId] = { sortOrder: DEFAULT_SORT_ORDER }
  return updates
}

function parseBody(html: string): HTMLElement {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
    .body
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/**
 * The signature of an identity as the editor takes it: the HTML one
 * sanitized as an email body, its PublicAsset images keeping their id in
 * the editor reference; or the text one, its lines kept
 */
export function signatureToEditorHtml(
  identity: Pick<IdentitySummary, 'htmlSignature' | 'textSignature'>
): string {
  const html = identity.htmlSignature.trim()
  if (html === '') {
    const text = identity.textSignature.trim()
    return text === ''
      ? ''
      : `<p>${escapeHtml(text).replaceAll('\n', '<br>')}</p>`
  }
  const assetBySource = new Map<string, string>()
  parseBody(html)
    .querySelectorAll(`img[${PUBLIC_ASSET_ATTRIBUTE}]`)
    .forEach(image => {
      const source = image.getAttribute('src')
      const assetId = image.getAttribute(PUBLIC_ASSET_ATTRIBUTE)
      if (source && assetId) assetBySource.set(source, assetId)
    })
  const body = parseBody(sanitizeSignature(html))
  body.querySelectorAll('img').forEach(image => {
    const assetId = assetBySource.get(image.getAttribute('src') ?? '')
    if (assetId) image.setAttribute(EDITOR_REFERENCE_ATTRIBUTE, assetId)
  })
  return body.innerHTML
}

/**
 * The HTML signature to store from the editor's: its images name their
 * PublicAsset as tmail-flutter expects (`public-asset-id`)
 */
export function signatureFromEditorHtml(html: string): string {
  const body = parseBody(html)
  body.querySelectorAll(`img[${EDITOR_REFERENCE_ATTRIBUTE}]`).forEach(image => {
    const assetId = image.getAttribute(EDITOR_REFERENCE_ATTRIBUTE)
    image.removeAttribute(EDITOR_REFERENCE_ATTRIBUTE)
    if (assetId) image.setAttribute(PUBLIC_ASSET_ATTRIBUTE, assetId)
  })
  return body.innerHTML
}

/** The ids of the PublicAssets a stored HTML signature shows */
export function publicAssetIdsIn(html: string): string[] {
  if (!html.includes(PUBLIC_ASSET_ATTRIBUTE)) return []
  const ids = new Set<string>()
  parseBody(html)
    .querySelectorAll(`img[${PUBLIC_ASSET_ATTRIBUTE}]`)
    .forEach(image => {
      const id = image.getAttribute(PUBLIC_ASSET_ATTRIBUTE)
      if (id) ids.add(id)
    })
  return [...ids]
}

const BLOCKS = 'p, div, br, li, tr, h1, h2, h3, h4, h5, h6, blockquote'

/** A short text of a signature, for the list of identities */
export function signaturePreview(
  identity: Pick<IdentitySummary, 'htmlSignature' | 'textSignature'>
): string {
  const html = identity.htmlSignature.trim()
  if (html === '') return identity.textSignature.replace(/\s+/g, ' ').trim()
  const body = parseBody(sanitizeSignature(html))
  // Blocks and line breaks end words
  body.querySelectorAll(BLOCKS).forEach(element => {
    element.after(' ')
  })
  return body.textContent.replace(/\s+/g, ' ').trim()
}
