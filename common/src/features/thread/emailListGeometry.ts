import type { RowLayout } from '@/ds/VirtualizedListTable/VirtualizedListTable'

/** Padding of a row and gap between its cells, in px (Figma "Listitemmail") */
export const ROW_LAYOUT: RowLayout = {
  paddingX: 8,
  paddingTop: 6,
  paddingBottom: 5,
  gap: 8
}

/** An icon button of a row, in px */
export const ACTION_SIZE = 32

/** Selection, star and reply: three icon buttons without gap */
export const LEAD_WIDTH = ROW_LAYOUT.paddingX + 3 * ACTION_SIZE

/** The actions replacing the date on hover: five icon buttons without gap */
export const TRAILING_WIDTH =
  ROW_LAYOUT.gap + 5 * ACTION_SIZE + ROW_LAYOUT.paddingX

/** Without hover the date stays beside the (always visible) actions */
export function getTrailingWidth(canHover: boolean): number {
  return canHover ? TRAILING_WIDTH : TRAILING_WIDTH + 72
}
