/**
 * The Twake Drive picker, a cozy-stack intent (`PICK io.cozy.files`) shown
 * with cozy-interapp: the data it is sent and what it gives back, checked as
 * tmail-flutter's `DriveOriginValidator` does.
 */

/** A file picked in Twake Drive */
export interface DriveFile {
  id: string
  name: string
  /** Bytes, null when Drive does not say */
  size: number | null
  mimeType: string | null
  /** Set when the user chose to insert a link */
  sharingLink: string | null
  /** Set when the user chose to attach the file: where to download it */
  downloadLink: string | null
  thumbnail: string | null
}

/** What the picker offers, sent to it once it is ready */
export interface DrivePickerOptions {
  /** "Insert a link" */
  linkLabel: string
  /** "Attach", null when the files cannot be attached */
  attachLabel: string | null
  /** Largest file that can be attached, in bytes */
  maxFileSize: number | null
  theme: 'light' | 'dark'
}

/**
 * The data of the intent (Drive's `FilePickerConfig`, see twake-drive
 * `docs/file-picker-intent.md`), as tmail-flutter sends it: one picker with
 * both actions, the user chooses in Drive. What each one makes Drive do:
 *
 * - `downloadLink` ("Add as attachment"): a link to download the file,
 *   valid 10 minutes, that we fetch and attach. No lasting public link,
 *   but for the files of the user (not of a shared drive) Drive grants
 *   itself a 5-minute read-only share by link (`POST
 *   /permissions?codes=code&ttl=5m`) to mint that link: it shows in
 *   `shared-by-link` though it is expired. No option avoids it; Drive asks
 *   none for the files of a shared drive.
 * - `sharingLink` ("Add as link"): a permanent public link, read-only by
 *   default (Drive asks for the access, a password and an expiry date),
 *   created with `POST /permissions` or an existing one updated with
 *   `PATCH /permissions/:id`.
 * - A double click on a file picks it with the first enabled of
 *   `sharingLink`, then `downloadLink`: a public link. Only `sharingLink:
 *   null` would make it attach; tmail-flutter offers both, so do we.
 * - `null` hides an action: `downloadLink` is null when the server cannot
 *   take attachments. `maxFileSize` and `availableSize` only disable the
 *   button for larger files.
 *
 * `multiple: true` is Drive's default, sent to be explicit. Not sent:
 * `displayCloseButton`, ignored by Drive (its header always has a close
 * button, which cancels the intent).
 */
export function pickerData(
  options: DrivePickerOptions
): Record<string, unknown> {
  return {
    multiple: true,
    sharingLink: { label: options.linkLabel },
    downloadLink:
      options.attachLabel === null
        ? null
        : {
            label: options.attachLabel,
            ...(options.maxFileSize === null
              ? {}
              : {
                  maxFileSize: options.maxFileSize,
                  availableSize: options.maxFileSize
                })
          },
    theme: { type: options.theme }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

/** An https URL; http only on a local machine (tmail-flutter's rule) */
function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ||
      (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))
      ? url.href
      : null
  } catch {
    return null
  }
}

/**
 * The page of the picker in the intent the stack created (`POST /intents`,
 * JSON:API): an https URL (http only on a local machine), or null
 */
export function readPickerHref(intent: unknown): string | null {
  if (!isRecord(intent) || !isRecord(intent.attributes)) return null
  const services = intent.attributes.services
  const first: unknown = Array.isArray(services) ? services[0] : null
  return isRecord(first) ? safeUrl(first.href) : null
}

function readFile(value: unknown): DriveFile | null {
  if (!isRecord(value)) return null
  const id = [value.id, value._id, value.file_id].find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate !== ''
  )
  const name = [value.name, value.filename].find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate !== ''
  )
  const size =
    typeof value.size === 'number'
      ? value.size
      : typeof value.size === 'string' && /^\d+$/.test(value.size)
        ? Number(value.size)
        : null
  if (id === undefined || name === undefined) return null
  if (size !== null && size < 0) return null
  const sharingLink = safeUrl(value.sharingLink ?? value.url)
  const downloadLink = safeUrl(value.downloadLink)
  if (sharingLink === null && downloadLink === null) return null
  const thumbnail = isRecord(value.thumbnail)
    ? safeUrl(value.thumbnail.link)
    : null
  return {
    id,
    name,
    size,
    mimeType:
      typeof value.mimeType === 'string' && value.mimeType !== ''
        ? value.mimeType
        : null,
    sharingLink,
    downloadLink,
    thumbnail
  }
}

/**
 * The files of the document the picker ends with: those with a valid link
 * (https, http on a local machine), the others dropped
 */
export function readPickedFiles(document: unknown): DriveFile[] {
  const list: unknown[] = Array.isArray(document) ? document : [document]
  return list.map(readFile).filter((file): file is DriveFile => file !== null)
}
