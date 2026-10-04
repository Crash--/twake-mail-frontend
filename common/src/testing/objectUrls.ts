/**
 * `URL.createObjectURL` and `revokeObjectURL` for jsdom, which has neither:
 * the blobs are kept by URL, so that tests can read what the app loads in a
 * frame or an image (`readObjectUrl`).
 */
const blobs = new Map<string, Blob>()
let counter = 0

export function installObjectUrls(): void {
  Object.assign(URL, {
    createObjectURL: (blob: Blob): string => {
      counter += 1
      const url = `blob:https://mail.example.com/${counter}`
      blobs.set(url, blob)
      return url
    },
    revokeObjectURL: (url: string): void => {
      blobs.delete(url)
    }
  })
}

/** The text of the blob behind an object URL, null once revoked */
export async function readObjectUrl(url: string): Promise<string | null> {
  const blob = blobs.get(url)
  if (!blob) return null
  // jsdom's Blob has no text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Cannot read the blob'))
    }
    reader.readAsText(blob)
  })
}
