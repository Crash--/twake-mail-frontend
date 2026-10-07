const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const

/**
 * A file size in the language of the UI: `29 bytes`, `12 kB`, `3,4 Mo`…
 * Bytes use the long form: the short one reads `29 byte` in English.
 */
export function formatSize(bytes: number, lang: string): string {
  let value = bytes
  let unitIndex = 0
  while (value >= 1000 && unitIndex < UNITS.length - 1) {
    value /= 1000
    unitIndex += 1
  }
  return new Intl.NumberFormat(lang, {
    style: 'unit',
    unit: UNITS[unitIndex],
    unitDisplay: unitIndex === 0 ? 'long' : 'short',
    maximumFractionDigits: unitIndex === 0 ? 0 : 1
  }).format(value)
}
