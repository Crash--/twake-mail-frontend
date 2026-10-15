/**
 * Whether a file of this media type is text, its part needing a charset: a
 * `text/*` type that does not name one already
 */
export function needsCharset(type: string): boolean {
  const [mediaType = '', ...parameters] = type.toLowerCase().split(';')
  return (
    mediaType.trim().startsWith('text/') &&
    !parameters.some(parameter => parameter.trim().startsWith('charset='))
  )
}

const UTF16_BOMS: readonly { bom: readonly number[]; charset: string }[] = [
  { bom: [0xff, 0xfe], charset: 'UTF-16LE' },
  { bom: [0xfe, 0xff], charset: 'UTF-16BE' }
]

function isUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return true
  } catch {
    return false
  }
}

/** C1 controls, which a Latin text holds only as Windows-1252 characters */
function hasWindows1252Characters(bytes: Uint8Array): boolean {
  return bytes.some(byte => byte >= 0x80 && byte <= 0x9f)
}

/**
 * The charset of a text file (tmail-flutter#2602): UTF-8 when its bytes
 * decode as such, UTF-16 when a byte order mark says so, else a Latin one
 * (Windows-1252 when it uses its extra characters, ISO-8859-1 otherwise)
 */
export function detectCharset(bytes: Uint8Array): string {
  if (isUtf8(bytes)) return 'UTF-8'
  const utf16 = UTF16_BOMS.find(({ bom }) =>
    bom.every((byte, index) => bytes[index] === byte)
  )
  if (utf16) return utf16.charset
  return hasWindows1252Characters(bytes) ? 'windows-1252' : 'ISO-8859-1'
}

/** `FileReader`, not `Blob.arrayBuffer()`, which jsdom lacks */
function readBytes(file: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(
        reader.result instanceof ArrayBuffer
          ? new Uint8Array(reader.result)
          : new Uint8Array()
      )
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Unreadable file'))
    }
    reader.readAsArrayBuffer(file)
  })
}

/** The charset of a file to attach, null when it is not text */
export async function fileCharset(
  file: Blob,
  type: string
): Promise<string | null> {
  if (!needsCharset(type)) return null
  return detectCharset(await readBytes(file))
}
