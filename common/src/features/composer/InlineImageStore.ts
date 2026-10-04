import type { EmailBodyPartCreate, JmapClient } from 'jmap-client-ts'

/** An image of the message, stored as a JMAP blob */
export interface StoredImage {
  cid: string
  blobId: string
  type: string
  size: number
  name: string
  /** Object URL while the composer is open, null until downloaded */
  url: string | null
}

/** Images wider than this are scaled down before upload */
export const MAX_IMAGE_WIDTH = 1280
/** Images heavier than this are re-encoded even when narrow enough */
const MAX_IMAGE_BYTES = 1_000_000
const JPEG_QUALITY = 0.85

export interface ResizeResult {
  blob: Blob
  width: number
  height: number
  originalBytes: number
}

/**
 * Scales an image down to `MAX_IMAGE_WIDTH` (browser resampling, high
 * quality) and re-encodes it when it is too heavy. tmail-flutter web sends
 * images as they are; on mobile it compresses above 300 KB (quality 50,
 * ADR 0011). GIFs are left alone (animation).
 */
export async function resizeImage(file: Blob): Promise<ResizeResult> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  const tooWide = width > MAX_IMAGE_WIDTH
  if (file.type === 'image/gif' || (!tooWide && file.size <= MAX_IMAGE_BYTES)) {
    bitmap.close()
    return { blob: file, width, height, originalBytes: file.size }
  }
  bitmap.close()
  const scale = tooWide ? MAX_IMAGE_WIDTH / width : 1
  const targetWidth = Math.round(width * scale)
  const targetHeight = Math.round(height * scale)
  const resized = await createImageBitmap(file, {
    resizeWidth: targetWidth,
    resizeHeight: targetHeight,
    resizeQuality: 'high'
  })
  const canvas = new OffscreenCanvas(targetWidth, targetHeight)
  const context = canvas.getContext('2d')
  if (!context) {
    resized.close()
    return { blob: file, width, height, originalBytes: file.size }
  }
  context.drawImage(resized, 0, 0)
  resized.close()
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await canvas.convertToBlob({ type, quality: JPEG_QUALITY })
  // A PNG photo can grow when redrawn: keep the smaller one
  const smaller = blob.size < file.size || tooWide ? blob : file
  return {
    blob: smaller,
    width: smaller === file ? width : targetWidth,
    height: smaller === file ? height : targetHeight,
    originalBytes: file.size
  }
}

function newCid(): string {
  return `${crypto.randomUUID()}@twake.mail`
}

function extensionOf(type: string): string {
  return type.split('/')[1]?.replace('jpeg', 'jpg').replace('+xml', '') ?? 'bin'
}

/**
 * The inline images of one composer: uploaded ones, and the parts of the
 * quoted email or the draft that the message references by Content-ID.
 * Owns their object URLs (`dispose()` revokes them).
 */
export class InlineImageStore {
  readonly #client: JmapClient
  readonly #accountId: string
  readonly #images = new Map<string, StoredImage>()

  constructor(client: JmapClient, accountId: string) {
    this.#client = client
    this.#accountId = accountId
  }

  /** Resizes, uploads and registers an image file */
  async add(file: File): Promise<StoredImage & { resize: ResizeResult }> {
    const resize = await resizeImage(file)
    const type = resize.blob.type || file.type
    const uploaded = await this.#client.upload(
      this.#accountId,
      resize.blob,
      type
    )
    const cid = newCid()
    const image: StoredImage = {
      cid,
      blobId: uploaded.blobId,
      type,
      size: uploaded.size,
      name: file.name || `${cid.slice(0, 8)}.${extensionOf(type)}`,
      url: URL.createObjectURL(resize.blob)
    }
    this.#images.set(cid, image)
    return { ...image, resize }
  }

  /** Uploads a `data:` image (pasted, or quoted base64) and registers it */
  async addDataUrl(dataUrl: string): Promise<StoredImage> {
    const blob = await (await fetch(dataUrl)).blob()
    const extension = extensionOf(blob.type)
    const file = new File([blob], `image.${extension}`, { type: blob.type })
    const uploaded = await this.#client.upload(this.#accountId, file, blob.type)
    const cid = newCid()
    const image: StoredImage = {
      cid,
      blobId: uploaded.blobId,
      type: blob.type,
      size: uploaded.size,
      name: `${cid.slice(0, 8)}.${extension}`,
      url: null
    }
    this.#images.set(cid, image)
    return image
  }

  /** Registers an existing part (quoted email, reopened draft) */
  register(image: Omit<StoredImage, 'url'>): void {
    if (!this.#images.has(image.cid)) {
      this.#images.set(image.cid, { ...image, url: null })
    }
  }

  /** Downloads every registered image that has no URL yet */
  async downloadAll(signal?: AbortSignal): Promise<void> {
    await Promise.all(
      Array.from(this.#images.values())
        .filter(image => image.url === null)
        .map(async image => {
          const blob = await this.#client.download(
            {
              accountId: this.#accountId,
              blobId: image.blobId,
              type: image.type,
              name: image.name
            },
            { signal }
          )
          image.url = URL.createObjectURL(blob)
        })
    )
  }

  /** The parts of the saved draft: its images now live in these blobs */
  rebase(
    parts: readonly { cid: string | null; blobId: string | null }[]
  ): void {
    for (const part of parts) {
      if (!part.cid || !part.blobId) continue
      const image = this.#images.get(part.cid.replace(/^<|>$/g, ''))
      if (image) image.blobId = part.blobId
    }
  }

  urlFor(cid: string): string | null {
    return this.#images.get(cid)?.url ?? null
  }

  get(cid: string): StoredImage | null {
    return this.#images.get(cid) ?? null
  }

  /** What the snapshot keeps: everything but the URLs */
  toJSON(): Omit<StoredImage, 'url'>[] {
    return Array.from(this.#images.values(), image => ({
      cid: image.cid,
      blobId: image.blobId,
      type: image.type,
      size: image.size,
      name: image.name
    }))
  }

  /** The inline parts of the email for the Content-IDs its HTML references */
  attachmentsFor(cids: ReadonlySet<string>): EmailBodyPartCreate[] {
    return Array.from(cids).flatMap(cid => {
      const image = this.#images.get(cid)
      if (!image) return []
      return [
        {
          blobId: image.blobId,
          type: image.type,
          name: image.name,
          disposition: 'inline',
          cid
        }
      ]
    })
  }

  dispose(): void {
    for (const image of this.#images.values()) {
      if (image.url) URL.revokeObjectURL(image.url)
    }
    this.#images.clear()
  }
}
