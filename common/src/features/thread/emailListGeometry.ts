import { useMediaQuery } from '@linagora/twake-mui'

import { TOUCH_QUERY, TOUCH_TARGET_SIZE } from '@/ds/TouchTargets/TouchTargets'
import type { RowLayout } from '@/ds/VirtualizedListTable/VirtualizedListTable'

/**
 * Padding of a row and gap between its cells, in px, as tmail-flutter: 3 px
 * on the sides, 40 px controls 4 px below the top and 3 px above the 1 px
 * divider (48 px rows); the widths of the cells carry their own spacing. The
 * divider starts after the lead cell (120 px in).
 */
export const ROW_LAYOUT: RowLayout = {
  paddingX: 3,
  paddingTop: 4,
  paddingBottom: 3,
  gap: 0,
  insetDivider: true
}

/** An icon button of a row, in px */
export const ACTION_SIZE = 32

/**
 * The attachment (16 px and its 8 px margin), the longest list date ("Dec
 * 30, 2025", 12 px) with its 8 px and 20 px margins, shown beside the
 * actions on a screen without hover
 */
const DATE_BLOCK_WIDTH = 24 + 80 + 28

/** The checkbox (40 px, 4 px from the edge) and the two 28 px state slots */
const LEAD_FIXED_WIDTH = 44 + 2 * 28
/** The star of tmail-flutter: a bare 20 px icon */
const STAR_WIDTH = 20
/**
 * The folder of a search result before the attachment and the date: a pill
 * of at most 100 px and its 8 px margin (`ds/MailboxTag`)
 */
export const MAILBOX_TAG_ROOM = 108

/** After the actions of a hovered row, as tmail-flutter */
const ACTIONS_END_SPACE = 16

/** Between the subject and the date or actions */
const TRAILING_GAP = 16

export interface RowPointer {
  /** The screen can hover: the actions replace the date */
  canHover: boolean
  /** Touch screen or phone: icon buttons are 44 px touch targets */
  isTouch: boolean
}

function getButtonSize(isTouch: boolean): number {
  return isTouch ? TOUCH_TARGET_SIZE : ACTION_SIZE
}

/** Selection, star, answered and unread, without gap */
export function getLeadWidth(isTouch: boolean): number {
  return (
    ROW_LAYOUT.paddingX +
    LEAD_FIXED_WIDTH +
    (isTouch ? TOUCH_TARGET_SIZE : STAR_WIDTH)
  )
}

/**
 * The five actions without gap, which replace the date on hover; without
 * hover the date stays beside them
 */
export function getTrailingWidth({ canHover, isTouch }: RowPointer): number {
  const actionsWidth =
    TRAILING_GAP +
    5 * getButtonSize(isTouch) +
    ACTIONS_END_SPACE +
    ROW_LAYOUT.paddingX
  return canHover ? actionsWidth : actionsWidth + DATE_BLOCK_WIDTH
}

/** The pointer the row cells are sized for */
export function useRowPointer(): RowPointer {
  return {
    canHover: !useMediaQuery('(hover: none)'),
    isTouch: useMediaQuery(TOUCH_QUERY)
  }
}
