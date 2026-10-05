/**
 * Image sizes of the emails shown in the reader (EML-04). The stylesheet of
 * the frame caps every image at the width of the pane (`max-width: 100%`),
 * but an inline style wins over it: `height: 200px` keeps the height of a
 * `width: 2000px` image capped to 600 px, which deforms it, and an inline
 * `min-width` or `max-width` can push it past the pane. Without a script in
 * the frame, the width of the pane is unknown here (tmail-flutter measures
 * it): the ratio the email declares becomes an `aspect-ratio`, so that the
 * browser keeps it whatever the width it ends at.
 */

/** CSS pixels per unit, for the absolute units */
const PIXELS_PER_UNIT: Readonly<Record<string, number>> = {
  px: 1,
  pt: 4 / 3,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4
}

/** Values that set no limit, replaced by the width of the pane */
const NO_LIMIT = new Set(['none', 'auto', 'initial', 'inherit', 'unset'])

interface Declaration {
  property: string
  value: string
}

/** Splits `a: b; c: d` on the semicolons outside quotes and parentheses */
function splitDeclarations(style: string): Declaration[] {
  const declarations: Declaration[] = []
  let depth = 0
  let quote: string | null = null
  let start = 0
  const push = (end: number): void => {
    const text = style.slice(start, end)
    const colon = text.indexOf(':')
    if (colon > 0) {
      declarations.push({
        property: text.slice(0, colon).trim().toLowerCase(),
        value: text.slice(colon + 1).trim()
      })
    }
    start = end + 1
  }
  for (let index = 0; index < style.length; index += 1) {
    const char = style[index]
    if (quote !== null) {
      if (char === quote) quote = null
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '(') {
      depth += 1
    } else if (char === ')') {
      depth = Math.max(0, depth - 1)
    } else if (char === ';' && depth === 0) {
      push(index)
    }
  }
  push(style.length)
  return declarations
}

function round(pixels: number): number {
  return Math.round(pixels * 100) / 100
}

function withoutImportant(value: string): string {
  return value.replace(/\s*!important$/i, '').trim()
}

/** A length in CSS pixels, null for a relative or unknown one */
function toPixels(value: string | undefined): number | null {
  if (value === undefined) return null
  const match = /^(\d*\.?\d+)([a-z]*)$/i.exec(withoutImportant(value))
  if (!match) return null
  const [, amount = '', unit = ''] = match
  const perUnit = PIXELS_PER_UNIT[unit.toLowerCase() || 'px']
  const pixels = Number(amount) * (perUnit ?? Number.NaN)
  return Number.isFinite(pixels) && pixels > 0 ? pixels : null
}

/** A limit that never goes past the width of the pane */
function capped(value: string): string {
  const limit = withoutImportant(value)
  return NO_LIMIT.has(limit.toLowerCase()) ? '100%' : `min(${limit}, 100%)`
}

/** The `width` and `height` attributes of an image */
export interface ImageSizeAttributes {
  width: string | null
  height: string | null
}

/**
 * The inline style of an image of the reader: with a width and a height in
 * absolute units (its style first, else its attributes), the height becomes
 * `auto` and the ratio an `aspect-ratio`, which wins over the natural ratio
 * of the picture as the declared size did (a 600 × 1 spacer stays a line);
 * an inline `max-width` or `min-width` never goes past the pane. The other
 * declarations are kept; null when the image needs no style.
 */
export function normalizeImageStyle(
  style: string | null,
  attributes: ImageSizeAttributes = { width: null, height: null }
): string | null {
  const declarations = style === null ? [] : splitDeclarations(style)
  const last = (property: string): string | undefined =>
    declarations.findLast(declaration => declaration.property === property)
      ?.value
  const width = toPixels(last('width') ?? attributes.width ?? undefined)
  const height = toPixels(last('height') ?? attributes.height ?? undefined)
  const hasRatio = width !== null && height !== null
  const kept = declarations.flatMap(({ property, value }): string[] => {
    if (property === 'max-width' || property === 'min-width') {
      return [`${property}: ${capped(value)}`]
    }
    if (hasRatio && (property === 'height' || property === 'aspect-ratio')) {
      return []
    }
    return [`${property}: ${value}`]
  })
  if (hasRatio) {
    kept.push(
      'height: auto',
      `aspect-ratio: ${round(width)} / ${round(height)}`
    )
  }
  return kept.length === 0 ? style : kept.join('; ')
}
