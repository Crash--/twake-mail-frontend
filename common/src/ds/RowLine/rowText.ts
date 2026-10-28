/** The preview of a row, and anything quieter than its subject */
export const ROW_MUTED_COLOR = 'text.secondary'

/**
 * The sender, subject and preview of a mail list row: twake-mui's `body3`
 * (Inter 14 / 18.4, 0.25 letter spacing) in `text.primary`, Semi Bold (600)
 * when `isStrong` (an unread email)
 */
export function rowTextSx(isStrong: boolean): {
  typography: string
  fontWeight: number
  color: string
} {
  return {
    typography: 'body3',
    fontWeight: isStrong ? 600 : 400,
    color: 'text.primary'
  }
}

/** The date of a row: twake-mui's `caption` (12 px), Regular or Semi Bold */
export function rowDateSx(isStrong: boolean): {
  typography: string
  fontWeight: number
  color: string
} {
  return { ...rowTextSx(isStrong), typography: 'caption' }
}
