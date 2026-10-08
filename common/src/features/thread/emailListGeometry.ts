import { useMediaQuery } from '@linagora/twake-mui'

import { TOUCH_QUERY, TOUCH_TARGET_SIZE } from '@/ds/TouchTargets/TouchTargets'
import type { RowLayout } from '@/ds/VirtualizedListTable/VirtualizedListTable'

/**
 * Padding of a row and gap between its cells, in px. The 8 px on the sides
 * and between the cells are those of the Figma "Listitemmail"; above and
 * below, 8 px around 32 px icon buttons and the 1 px divider make the 48 px
 * rows of tmail-flutter (the design has 44 px, 6 px around the buttons).
 */
export const ROW_LAYOUT: RowLayout = {
  paddingX: 8,
  paddingTop: 8,
  paddingBottom: 7,
  gap: 8
}

/**
 * On a touch screen the buttons are 44 px: the padding shrinks to 6 px above
 * and 5 below, so that the rows stay the 56 px of the touch columns (#300)
 */
const TOUCH_ROW_LAYOUT: RowLayout = {
  ...ROW_LAYOUT,
  paddingTop: 6,
  paddingBottom: 5
}

export function getRowLayout(isTouch: boolean): RowLayout {
  return isTouch ? TOUCH_ROW_LAYOUT : ROW_LAYOUT
}

/** An icon button of a row, in px */
export const ACTION_SIZE = 32

/** The icon of the hover actions and of the replied / forwarded indicator */
export const ACTION_ICON_SIZE = 16

/**
 * The attachment (a 32 px box and its 4 px margin), the longest list date
 * ("Dec 30, 2025", 12 px) and the 8 px before the actions, shown beside the
 * actions on a screen without hover
 */
const DATE_BLOCK_WIDTH = 36 + 80 + 8

export interface RowPointer {
  /** The screen can hover: the actions replace the date */
  canHover: boolean
  /** Touch screen or phone: icon buttons are 44 px touch targets */
  isTouch: boolean
}

function getButtonSize(isTouch: boolean): number {
  return isTouch ? TOUCH_TARGET_SIZE : ACTION_SIZE
}

/**
 * Selection, star and the replied / forwarded indicator without gap: the
 * checkbox keeps its size. The indicator is no control, but its column keeps
 * the width the touch targets of the tablet were given (#300).
 */
export function getLeadWidth(isTouch: boolean): number {
  return ROW_LAYOUT.paddingX + ACTION_SIZE + 2 * getButtonSize(isTouch)
}

/**
 * The five actions without gap, which replace the date on hover; without
 * hover the date stays beside them
 */
export function getTrailingWidth({ canHover, isTouch }: RowPointer): number {
  const actionsWidth =
    ROW_LAYOUT.gap + 5 * getButtonSize(isTouch) + ROW_LAYOUT.paddingX
  return canHover ? actionsWidth : actionsWidth + DATE_BLOCK_WIDTH
}

/** The pointer the row cells are sized for */
export function useRowPointer(): RowPointer {
  return {
    canHover: !useMediaQuery('(hover: none)'),
    isTouch: useMediaQuery(TOUCH_QUERY)
  }
}
