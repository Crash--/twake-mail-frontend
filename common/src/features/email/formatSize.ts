const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const

/** A file size in the language of the UI: `12 kB`, `3,4 Mo`… */
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
    unitDisplay: 'short',
    maximumFractionDigits: unitIndex === 0 ? 0 : 1
  }).format(value)
}
