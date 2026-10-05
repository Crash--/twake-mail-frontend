/**
 * The text of a mail list row: Inter 14 / 18.4 with a 0.25 letter spacing,
 * Regular, Semi Bold (600) when `isStrong` (an unread email). twake-css has
 * no semi-bold utility (docs/twake-mui-gaps.md).
 */
export function rowTextSx(isStrong: boolean): {
  fontSize: number
  lineHeight: string
  letterSpacing: string
  fontWeight: number
  color: string
} {
  return {
    fontSize: 14,
    lineHeight: '18.4px',
    letterSpacing: '0.25px',
    fontWeight: isStrong ? 600 : 400,
    color: 'text.primary'
  }
}
