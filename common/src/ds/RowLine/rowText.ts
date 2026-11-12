/** The preview of a row, and anything quieter than its subject */
export const ROW_MUTED_COLOR = 'text.secondary'

/**
 * The sender, subject and preview of a mail list row: twake-mui's `body3`
 * (Inter 14 / 18.4, 0.25 letter spacing) in `text.primary`, its Semi Bold
 * twin `subtitle2` when `isStrong` (an unread email)
 */
export function rowTextSx(isStrong: boolean): {
  typography: string
  color: string
} {
  return {
    typography: isStrong ? 'subtitle2' : 'body3',
    color: 'text.primary'
  }
}

/** The date of a row: twake-mui's `caption` (12 px), Regular or Semi Bold */
export function rowDateSx(isStrong: boolean): {
  typography: string
  fontWeight: number
  color: string
} {
  return {
    ...rowTextSx(isStrong),
    typography: 'caption',
    // TODO: use twake-mui's 12 px Regular and Semi Bold variants once they
    // exist (https://github.com/Crash--/twake-ui/issues/21): `caption` is 500
    fontWeight: isStrong ? 600 : 400
  }
}
