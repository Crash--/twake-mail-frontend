/**
 * The images of a signature before they are published, as tmail-flutter's
 * identity creator prepares them: an image bigger than the server takes is
 * scaled down to a width and saved as a JPEG of quality 80.
 */

/** tmail-flutter's `qualityCompressedInlineImage` */
const QUALITY = 0.8
/** tmail-flutter's `maxWidthInlineImageDesktop` and `…Other`, in px */
const MAX_WIDTH_DESKTOP = 800
const MAX_WIDTH_OTHER = 700

/** How wide a shrunk image may be: 40 % of the screen, at least 800 / 700 px */
export function signatureImageMaxWidth(
  screenWidth: number,
  isDesktop: boolean
): number {
  return Math.max(
    screenWidth * 0.4,
    isDesktop ? MAX_WIDTH_DESKTOP : MAX_WIDTH_OTHER
  )
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

/**
 * The image as it can be uploaded: the same file when the server takes its
 * size, a smaller JPEG otherwise; null when it cannot be shrunk
 */
export async function shrinkSignatureImage(
  file: File,
  maxSize: number,
  maxWidth: number
): Promise<File | null> {
  if (file.size <= maxSize) return file
  try {
    const bitmap = await createImageBitmap(file)
    const size = scaledImageSize(bitmap.width, bitmap.height, maxWidth)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) return null
    // A JPEG has no transparency: a transparent logo stays on white
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, size.width, size.height)
    context.drawImage(bitmap, 0, 0, size.width, size.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', QUALITY)
    })
    if (!blob) return null
    const name = `${file.name.replace(/\.[^.]*$/, '')}.jpg`
    return new File([blob], name, { type: 'image/jpeg' })
  } catch (error: unknown) {
    console.warn('[identities] Cannot shrink the image', error)
    return null
  }
}
