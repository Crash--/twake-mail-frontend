/**
 * The Twake Drive picker, a cozy-stack intent (`PICK io.cozy.files`): its
 * creation and the messages of its iframe (`intent-<id>:<subtype>`, the
 * protocol of cozy-interapp), checked as tmail-flutter's
 * `DriveOriginValidator` does.
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

/** The intent the stack created: its id and the page of the picker */
export interface DriveIntent {
  id: string
  href: string
  /** Origin of `href`, the only one whose messages count */
  origin: string
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

/** The data of the intent, as tmail-flutter and Twake Calendar send it */
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
    displayCloseButton: true,
    theme: { type: options.theme }
  }
}

/** The body of `POST /intents` */
export function intentRequest(
  data: Record<string, unknown>
): Record<string, unknown> {
  return {
    data: {
      type: 'io.cozy.intents',
      attributes: {
        action: 'PICK',
        type: 'io.cozy.files',
        data,
        permissions: ['GET']
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

/** An https URL; http only on a local machine (tmail-flutter's rule) */
export function safeUrl(value: unknown): string | null {
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
 * The intent of the `POST /intents` response: its id and the page of the
 * picker (an https URL; http only on a local machine), or null.
 */
export function readIntent(response: unknown): DriveIntent | null {
  const data = isRecord(response) ? response.data : null
  if (!isRecord(data) || typeof data.id !== 'string') return null
  const attributes = isRecord(data.attributes) ? data.attributes : null
  const services = Array.isArray(attributes?.services)
    ? attributes.services
    : []
  const first: unknown = services[0]
  const href = isRecord(first) ? safeUrl(first.href) : null
  if (href === null) return null
  return { id: data.id, href, origin: new URL(href).origin }
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

/** What a message of the picker means */
export type DriveIntentMessage =
  | { type: 'ready' }
  | { type: 'readyToUse' }
  | { type: 'done'; files: DriveFile[] }
  | { type: 'cancel' }
  | { type: 'error' }

/**
 * A `message` event as the picker speaks it, or null when it is not one of
 * the picker of this intent (another origin, another intent, another
 * format). The links of the files must be https (http on a local machine);
 * a file without a valid link is dropped.
 */
export function readIntentMessage(
  event: { origin: string; data: unknown },
  intent: Pick<DriveIntent, 'id' | 'origin'>
): DriveIntentMessage | null {
  if (event.origin !== intent.origin || !isRecord(event.data)) return null
  const type = event.data.type
  if (typeof type !== 'string') return null
  const prefix = `intent-${intent.id}:`
  if (!type.startsWith(prefix)) return null
  switch (type.slice(prefix.length)) {
    case 'ready':
      return { type: 'ready' }
    case 'readyToUse':
      return { type: 'readyToUse' }
    case 'cancel':
      return { type: 'cancel' }
    case 'error':
      return { type: 'error' }
    case 'done': {
      const document = event.data.document
      const list: unknown[] = Array.isArray(document) ? document : [document]
      return {
        type: 'done',
        files: list
          .map(readFile)
          .filter((file): file is DriveFile => file !== null)
      }
    }
    default:
      return null
  }
}
