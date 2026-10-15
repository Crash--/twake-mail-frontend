/**
 * The images of a signature before they are published. A signature travels
 * with every email: an image is shown at most at a signature width, given
 * as a `width` attribute (Outlook ignores `max-width`), and an image heavier
 * than a small budget is scaled down to that width and saved as a JPEG of
 * quality 80 (tmail-flutter's `qualityCompressedInlineImage`).
 */

const QUALITY = 0.8
/** tmail-flutter's `maxWidthInlineImageDesktop` and `…Other`, in px */
const MAX_WIDTH_DESKTOP = 800
const MAX_WIDTH_OTHER = 700
/** Above this size, an image is re-encoded, in bytes */
export const SIGNATURE_IMAGE_BUDGET = 128 * 1024

/** How wide a signature image may be: 800 px on a desktop, 700 px elsewhere */
export function signatureImageMaxWidth(isDesktop: boolean): number {
  return isDesktop ? MAX_WIDTH_DESKTOP : MAX_WIDTH_OTHER
}

/** The size of an image scaled down to `maxWidth`, never up */
export function scaledImageSize(
  width: number,
  height: number,
  maxWidth: number
): { width: number; height: number } {
  if (width <= maxWidth) return { width, height }
  return {
    width: Math.round(maxWidth),
    height: Math.max(1, Math.round((height * maxWidth) / width))
  }
}

/** An image ready to be published, and the width to show it at */
export interface SignatureImage {
  file: File
  /** null when the image cannot be read: it keeps its own width */
  width: number | null
}

async function decodeImage(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file)
  } catch (error: unknown) {
    console.warn('[identities] Cannot read the image', error)
    return null
  }
}

async function encodeJpeg(
  bitmap: ImageBitmap,
  size: { width: number; height: number }
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) return null
  // A JPEG has no transparency: a transparent logo stays on white
  context.fillStyle = '#FFFFFF'
  context.fillRect(0, 0, size.width, size.height)
  context.drawImage(bitmap, 0, 0, size.width, size.height)
  return new Promise<Blob | null>(resolve => {
    canvas.toBlob(resolve, 'image/jpeg', QUALITY)
  })
}

function jpegFile(blob: Blob, original: File): File {
  const name = `${original.name.replace(/\.[^.]*$/, '')}.jpg`
  return new File([blob], name, { type: 'image/jpeg' })
}

/**
 * The image as it can be published: the same file when it fits the budget,
 * a smaller JPEG otherwise, the original when it cannot be re-encoded but
 * the server takes it; null when nothing fits `maxUploadSize`
 */
export async function prepareSignatureImage(
  file: File,
  maxWidth: number,
  maxUploadSize: number
): Promise<SignatureImage | null> {
  const asItIs = file.size <= maxUploadSize ? file : null
  const bitmap = await decodeImage(file)
  if (bitmap === null) return asItIs && { file: asItIs, width: null }
  try {
    const size = scaledImageSize(bitmap.width, bitmap.height, maxWidth)
    if (file.size <= SIGNATURE_IMAGE_BUDGET) return { file, width: size.width }
    const blob = await encodeJpeg(bitmap, size).catch((error: unknown) => {
      console.warn('[identities] Cannot shrink the image', error)
      return null
    })
    if (blob === null || blob.size >= file.size) {
      return asItIs && { file: asItIs, width: size.width }
    }
    return { file: jpegFile(blob, file), width: size.width }
  } finally {
    bitmap.close()
  }
}
