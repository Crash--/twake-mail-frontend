/**
 * Which attachments can be previewed, as in tmail-flutter
 * (`Attachment.isPreviewSupported`): PDF, .eml, HTML, images, text and JSON.
 * PDF and HTML are told by their MIME type, or by their extension when the
 * type is `application/octet-stream`; images and text by their extension,
 * then by their MIME type.
 */
export type PreviewKind = 'pdf' | 'eml' | 'html' | 'image' | 'text'

export interface PreviewablePart {
  type: string
  name: string | null
}

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'bmp',
  'svg',
  'webp',
  'heic',
  'heif',
  'avif',
  'tiff'
])
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'log', 'json'])
// Extensions tmail-flutter files under "code", which it does not preview
const OTHER_KNOWN_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'rtf',
  'odt',
  'xls',
  'xlsx',
  'csv',
  'tsv',
  'ods',
  'ppt',
  'pptx',
  'odp',
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'aac',
  'flac',
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm',
  'wmv',
  'zip',
  'rar',
  '7z',
  'tar',
  'gz',
  'bz2',
  'js',
  'ts',
  'html',
  'css',
  'xml',
  'java',
  'kt',
  'dart',
  'py',
  'c',
  'cpp',
  'h',
  'cs',
  'swift',
  'go',
  'rb',
  'php',
  'sh',
  'yml',
  'yaml',
  'apk',
  'ipa',
  'exe',
  'dmg'
])

const OCTET_STREAM = 'application/octet-stream'

export function extensionOf(name: string | null): string | null {
  if (!name?.includes('.')) return null
  return name.split('.').pop()?.toLowerCase() ?? null
}

export function previewKind(part: PreviewablePart): PreviewKind | null {
  const type = part.type.toLowerCase()
  const extension = extensionOf(part.name)
  const isOctetStream = type === OCTET_STREAM

  if (type === 'application/pdf' || (isOctetStream && extension === 'pdf')) {
    return 'pdf'
  }
  if (type === 'message/rfc822') return 'eml'
  if (type === 'text/html' || (isOctetStream && extension === 'html')) {
    return 'html'
  }
  if (extension !== null && IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (extension !== null && TEXT_EXTENSIONS.has(extension)) return 'text'
  if (type === 'application/json') return 'text'
  // Like tmail-flutter, the MIME type decides only when the extension tells
  // nothing
  if (extension === null || !OTHER_KNOWN_EXTENSIONS.has(extension)) {
    if (type.startsWith('image/')) return 'image'
    if (type.startsWith('text/')) return 'text'
  }
  return null
}

const IMAGE_TYPES: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  avif: 'image/avif'
}
const SAFE_IMAGE_TYPES = new Set(Object.values(IMAGE_TYPES))

/**
 * The type given to the blob of an image preview: never the one the sender
 * declared as is, only a known image type, so that the blob is never taken
 * for a document (HTML, XML) if it were navigated to. An SVG is shown by an
 * `<img>`, where it runs no script and loads nothing.
 */
export function imageBlobType(part: PreviewablePart): string {
  const declared = part.type.toLowerCase()
  if (SAFE_IMAGE_TYPES.has(declared)) return declared
  const extension = extensionOf(part.name)
  return (
    (extension !== null ? IMAGE_TYPES[extension] : undefined) ?? OCTET_STREAM
  )
}

/** Previewed text beyond this size is cut: a huge log would freeze the tab */
export const MAX_TEXT_PREVIEW_BYTES = 1024 * 1024
