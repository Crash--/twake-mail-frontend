import type { StoredImage } from './InlineImageStore'

/**
 * The composer kept across a reload (tmail-flutter ADR 0009 and 0112):
 * written synchronously to sessionStorage on `beforeunload`, read when the
 * composer opens again, removed when it closes normally. Images are kept by
 * Content-ID and blob id, never by object URL.
 */
export interface ComposerSnapshot {
  identityId: string | null
  to: string
  subject: string
  /** Editor HTML, images in `cid:` form */
  html: string
  images: Omit<StoredImage, 'url'>[]
  draftId: string | null
  inReplyTo: string[] | null
  references: string[] | null
}

export function snapshotKey(accountId: string, composerId: string): string {
  return `twake-mail-composer|${accountId}|${composerId}`
}

/** Editor HTML with its image URLs swapped for their Content-IDs */
export function toStorageHtml(editorHtml: string): string {
  return editorHtml.replace(
    /<img([^>]*?)src="blob:[^"]*"([^>]*?)data-reference="([^"]+)"/g,
    '<img$1src="cid:$3"$2data-reference="$3"'
  )
}

export function writeSnapshot(key: string, snapshot: ComposerSnapshot): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(snapshot))
  } catch (error: unknown) {
    // Quota exceeded: the draft on the server is the fallback
    console.warn('Composer snapshot not written', error)
  }
}

function isSnapshot(value: unknown): value is ComposerSnapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    'html' in value &&
    typeof value.html === 'string' &&
    'images' in value &&
    Array.isArray(value.images)
  )
}

export function readSnapshot(key: string): ComposerSnapshot | null {
  const raw = sessionStorage.getItem(key)
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function removeSnapshot(key: string): void {
  sessionStorage.removeItem(key)
}
