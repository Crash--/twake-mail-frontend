/**
 * Reads a colour typed by a person: `#RRGGBB`, `RRGGBB`, `#RGB` or `RGB`, in
 * any case, spaces around. Returns `#RRGGBB` in capitals (the form the
 * swatches and tmail-flutter write), or null when it is not a colour.
 */
export function normalizeHexColor(text: string): string | null {
  const digits = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim())?.[1]
  if (digits === undefined) return null
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map(digit => digit + digit)
          .join('')
      : digits
  return `#${full.toUpperCase()}`
}
