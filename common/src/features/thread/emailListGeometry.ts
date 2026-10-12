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

/**
 * The compact rows of tmail-flutter (phones and tablets): 72 px high, 12 px
 * at the sides on a phone, 24 px on a tablet, the three lines 12 px after the
 * 48 px avatar, a divider within the side margins, white while emails are
 * selected
 */
export function getCompactRowLayout(
  isPhone: boolean,
  isSelecting = false
): RowLayout {
  const sides = isPhone ? 12 : 24
  return {
    paddingX: sides,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
    dividerMarginX: sides,
    hideDivider: isSelecting
  }
}

/** An icon button of a row, in px: tmail-flutter's 16 px icon and 5 px around */
export const ACTION_SIZE = 26

/** Between the actions of a hovered row, as tmail-flutter */
export const ACTION_GAP = 11

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
const ACTIONS_END_SPACE = 20

/** Between the subject and the date or actions */
const TRAILING_GAP = 16

/** After the actions of a hovered row: their 16 px end padding */
const HOVER_ACTIONS_END = 16

/**
 * With hover, the cell of the date keeps the 14 px rounded end of a hovered
 * or selected row (`VirtualizedListTable`); the room kept in the subject is
 * as much narrower
 */
const HOVER_CORNER = 14

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
 * The cell of the date and the actions. Without hover: the five actions, 11
 * px apart, beside the date. With hover, as tmail-flutter's flex line, the
 * preview runs up to the date of each row and up to the actions on hover:
 * the cell keeps only the padding of the row, its content runs out of it
 * over the room `RowHoverSpace` keeps in the cell of the subject.
 */
export function getTrailingWidth({ canHover, isTouch }: RowPointer): number {
  if (canHover) return ROW_LAYOUT.paddingX + HOVER_CORNER
  return (
    TRAILING_GAP +
    5 * getButtonSize(isTouch) +
    4 * ACTION_GAP +
    ACTIONS_END_SPACE +
    ROW_LAYOUT.paddingX +
    DATE_BLOCK_WIDTH
  )
}

/**
 * The room of the actions of a hovered row at the end of the subject, gap
 * before them included: the five actions (26 px, 44 px touch targets), 11
 * px apart, and their 16 px end padding, less what the cell of the date
 * holds
 */
export function getHoverActionsRoom(isTouch: boolean): number {
  return (
    TRAILING_GAP +
    5 * getButtonSize(isTouch) +
    4 * ACTION_GAP +
    HOVER_ACTIONS_END -
    HOVER_CORNER
  )
}

/**
 * Before the room of the date at the end of the subject: tmail-flutter's 16
 * px between the preview and the date, less what the cell of the date holds
 */
export const HOVER_DATE_GAP = TRAILING_GAP - HOVER_CORNER

/**
 * The cell of the date of a loading row: with hover, the room of a date
 * (its 56 px bar, 16 px before, 20 px after); as the real cell otherwise
 */
export function getSkeletonTrailingWidth(pointer: RowPointer): number {
  return pointer.canHover
    ? ROW_LAYOUT.paddingX + TRAILING_GAP + 56 + ACTIONS_END_SPACE
    : getTrailingWidth(pointer)
}

/** The pointer the row cells are sized for */
export function useRowPointer(): RowPointer {
  return {
    canHover: !useMediaQuery('(hover: none)'),
    isTouch: useMediaQuery(TOUCH_QUERY)
  }
}
