import { TMAIL } from '@/ds/TmailColors/tmailColors'

/** Black for an unread email, steel grey (`steelGray400`) once read */
export const ROW_STRONG_COLOR = TMAIL.textBlack
export const ROW_MUTED_COLOR = TMAIL.grey

/**
 * The subject, preview and date of a mail list row, as tmail-flutter
 * (`bodySmall`): Inter 12 / 16 with a 0.4 letter spacing; Semi Bold (600)
 * and black when `isStrong` (an unread email), Regular and steel grey
 * otherwise. twake-css has no semi-bold utility (docs/twake-mui-gaps.md).
 */
export function rowTextSx(isStrong: boolean): {
  fontSize: number
  lineHeight: string
  letterSpacing: string
  fontWeight: number
  color: string
} {
  return {
    fontSize: 12,
    lineHeight: '16px',
    letterSpacing: '0.4px',
    fontWeight: isStrong ? 600 : 400,
    color: isStrong ? ROW_STRONG_COLOR : ROW_MUTED_COLOR
  }
}

/**
 * The sender of a mail list row, as tmail-flutter: Inter 15 / 20, Semi Bold
 * and black when unread, Regular and steel grey once read
 */
export function rowSenderSx(isStrong: boolean): {
  fontSize: number
  lineHeight: string
  letterSpacing: string
  fontWeight: number
  color: string
} {
  return {
    fontSize: 15,
    lineHeight: '20px',
    letterSpacing: '0px',
    fontWeight: isStrong ? 600 : 400,
    color: isStrong ? ROW_STRONG_COLOR : ROW_MUTED_COLOR
  }
}
