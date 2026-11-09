import { useMediaQuery } from '@linagora/twake-mui'

import { TOUCH_QUERY, TOUCH_TARGET_SIZE } from '@/ds/TouchTargets/TouchTargets'
import type { RowLayout } from '@/ds/VirtualizedListTable/VirtualizedListTable'

/**
 * Padding of a row and gap between its cells, in px: 24 px on the sides, 6 px
 * above and below its 32 px controls (44 px rows); the widths of the cells
 * carry their own spacing. The divider, drawn by the row, keeps a 16 px safe
 * zone on both sides.
 */
export const ROW_LAYOUT: RowLayout = {
  paddingX: 24,
  paddingTop: 6,
  paddingBottom: 6,
  gap: 0,
  dividerMarginX: 16
}

/**
 * The compact rows of tmail-flutter (phones and tablets): 72 px high, 12 px
 * at the sides on a phone, 24 px on a tablet, the three lines 12 px after the
 * 48 px touch target of the avatar, a divider within the side margins, white
 * while emails are selected
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

/** An icon button of a row, in px: a 16 px icon and 8 px around */
export const ACTION_SIZE = 32

/**
 * The attachment (20 px and its 8 px margin), the longest list date ("Dec
 * 30, 2025", 12 px) with its 8 px margin, shown beside the actions on a screen
 * without hover
 */
const DATE_BLOCK_WIDTH = 28 + 80 + 8

/**
 * The folder of a search result before the attachment and the date: a pill
 * of at most 100 px and its 8 px margin (`ds/MailboxTag`)
 */
export const MAILBOX_TAG_ROOM = 108

/** Between the subject and the date or actions */
const TRAILING_GAP = 16

/** More room before the actions of a hovered row, where the preview stops */
const HOVER_PREVIEW_SPACE = 16

export interface RowPointer {
  /** The screen can hover: the actions replace the date */
  canHover: boolean
  /** Touch screen or phone: icon buttons are 44 px touch targets */
  isTouch: boolean
}

function getButtonSize(isTouch: boolean): number {
  return isTouch ? TOUCH_TARGET_SIZE : ACTION_SIZE
}

/** Selection and star, then the two 32 px state slots, without gap */
export function getLeadWidth(isTouch: boolean): number {
  return ROW_LAYOUT.paddingX + 2 * getButtonSize(isTouch) + 2 * 32
}

/**
 * The cell of the date and the actions. Without hover: the five actions
 * beside the date. With hover, as tmail-flutter's flex line, the
 * preview runs up to the date of each row and up to the actions on hover:
 * the cell keeps only the padding of the row, its content runs out of it
 * over the room `RowHoverSpace` keeps in the cell of the subject.
 */
export function getTrailingWidth({ canHover, isTouch }: RowPointer): number {
  if (canHover) return ROW_LAYOUT.paddingX
  return (
    TRAILING_GAP +
    5 * getButtonSize(isTouch) +
    ROW_LAYOUT.paddingX +
    DATE_BLOCK_WIDTH
  )
}

/**
 * The room of the actions of a hovered row at the end of the subject, gap
 * before them included: the five actions (32 px, 44 px touch targets)
 */
export function getHoverActionsRoom(isTouch: boolean): number {
  return TRAILING_GAP + HOVER_PREVIEW_SPACE + 5 * getButtonSize(isTouch)
}

/** Before the room of the date at the end of the subject */
export const HOVER_DATE_GAP = TRAILING_GAP

/**
 * The cell of the date of a loading row: with hover, the room of a date
 * (its 56 px bar, 16 px before); as the real cell otherwise
 */
export function getSkeletonTrailingWidth(pointer: RowPointer): number {
  return pointer.canHover
    ? ROW_LAYOUT.paddingX + TRAILING_GAP + 56
    : getTrailingWidth(pointer)
}

/** The pointer the row cells are sized for */
export function useRowPointer(): RowPointer {
  return {
    canHover: !useMediaQuery('(hover: none)'),
    isTouch: useMediaQuery(TOUCH_QUERY)
  }
}
