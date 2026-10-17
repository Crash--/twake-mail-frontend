/**
 * The images of a signature before they are published. A signature travels
 * with every email: an image is shown at most at a signature width, given
 * as a `width` attribute (Outlook ignores `max-width`), and an image heavier
 * than a small budget is scaled down to that width and saved as a JPEG of
 * quality 80 (tmail-flutter's `qualityCompressedInlineImage`). Gmail and
 * Outlook show no SVG: an SVG image is drawn into a PNG first (tf#2401).
 */

import { IMAGE_TYPES } from '@/ds/RichTextEditor/RichTextEditor'

const QUALITY = 0.8
/** tmail-flutter's `maxWidthInlineImageDesktop` and `…Other`, in px */
const MAX_WIDTH_DESKTOP = 800
const MAX_WIDTH_OTHER = 700
/** Above this size, an image is re-encoded, in bytes */
export const SIGNATURE_IMAGE_BUDGET = 128 * 1024

export const SVG_TYPE = 'image/svg+xml'
/** The image types a signature takes: the editor's, and SVG (made a PNG) */
export const SIGNATURE_IMAGE_TYPES: readonly string[] = [
  ...IMAGE_TYPES,
  SVG_TYPE
]
/** The size browsers give an SVG without one of its own, in px */
const SVG_DEFAULT_SIZE = { width: 300, height: 150 }

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

interface ImageSize {
  width: number
  height: number
}

interface Encoding {
  type: 'image/jpeg' | 'image/png'
  /** Painted under the image; null keeps its transparency */
  background: string | null
}

// A JPEG has no transparency: a transparent logo stays on white
const JPEG: Encoding = { type: 'image/jpeg', background: '#FFFFFF' }
const PNG: Encoding = { type: 'image/png', background: null }

async function encodeImage(
  image: CanvasImageSource,
  size: ImageSize,
  { type, background }: Encoding
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) return null
  if (background !== null) {
    context.fillStyle = background
    context.fillRect(0, 0, size.width, size.height)
  }
  context.drawImage(image, 0, 0, size.width, size.height)
  return new Promise<Blob | null>(resolve => {
    canvas.toBlob(resolve, type, QUALITY)
  })
}

function renamedFile(blob: Blob, original: File, encoding: Encoding): File {
  const extension = encoding === JPEG ? 'jpg' : 'png'
  const name = `${original.name.replace(/\.[^.]*$/, '')}.${extension}`
  return new File([blob], name, { type: encoding.type })
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image()
    image.onload = () => {
      resolve(image)
    }
    image.onerror = () => {
      resolve(null)
    }
    image.src = url
  })
}

/** The size an SVG is drawn at: its own, else the browsers' default */
function svgSize(image: HTMLImageElement): ImageSize {
  const { naturalWidth: width, naturalHeight: height } = image
  return width > 0 && height > 0 ? { width, height } : SVG_DEFAULT_SIZE
}

/**
 * An SVG drawn into a PNG at most `maxWidth` wide, transparency kept; null
 * when the browser cannot draw it
 */
export async function rasterizeSvg(
  file: File,
  maxWidth: number
): Promise<File | null> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    if (image === null) {
      console.warn('[identities] Cannot read the SVG image')
      return null
    }
    const { width, height } = svgSize(image)
    const size = scaledImageSize(width, height, maxWidth)
    const blob = await encodeImage(image, size, PNG).catch((error: unknown) => {
      console.warn('[identities] Cannot draw the SVG image', error)
      return null
    })
    return blob && renamedFile(blob, file, PNG)
  } finally {
    URL.revokeObjectURL(url)
  }
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
    const blob = await encodeImage(bitmap, size, JPEG).catch(
      (error: unknown) => {
        console.warn('[identities] Cannot shrink the image', error)
        return null
      }
    )
    if (blob === null || blob.size >= file.size) {
      return asItIs && { file: asItIs, width: size.width }
    }
    return { file: renamedFile(blob, file, JPEG), width: size.width }
  } finally {
    bitmap.close()
  }
}
