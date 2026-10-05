import { DOCK_GAP, DOCK_MARGIN, OVERFLOW_MENU_WIDTH } from './WindowDock'
import {
  DOCKED_WINDOW_WIDTH,
  MINIMIZED_WINDOW_WIDTH,
  type DockedWindowMode
} from './DockedWindow'

/** How a window of the dock shows: a mode, or in the overflow menu */
export type FittedWindowMode = DockedWindowMode | 'overflow'

function fitInRoom(
  wanted: readonly DockedWindowMode[],
  room: number,
  startsWithGap: boolean
): FittedWindowMode[] {
  let left = room
  let isFirst = true
  return wanted.map(mode => {
    if (mode === 'fullscreen') return mode
    const gap = isFirst && !startsWithGap ? 0 : DOCK_GAP
    const wasFirst = isFirst
    isFirst = false
    if (mode === 'normal' && DOCKED_WINDOW_WIDTH + gap <= left) {
      left -= DOCKED_WINDOW_WIDTH + gap
      return 'normal'
    }
    // The newest stays in the dock, even on a screen too narrow for it
    if (MINIMIZED_WINDOW_WIDTH + gap <= left || wasFirst) {
      left -= MINIMIZED_WINDOW_WIDTH + gap
      return 'minimized'
    }
    return 'overflow'
  })
}

/**
 * The modes the windows of a dock can show in a screen `screenWidth` wide,
 * the newest first: each keeps the mode it asks for while it fits, else is
 * minimized, else goes to the overflow menu of the dock
 * (`WindowOverflowMenu`), which then takes its room too. A full screen
 * window takes no room in the dock. No window is ever left out without the
 * menu to reach it.
 */
export function fitWindows(
  wanted: readonly DockedWindowMode[],
  screenWidth: number
): FittedWindowMode[] {
  const room = screenWidth - 2 * DOCK_MARGIN
  const fitted = fitInRoom(wanted, room, false)
  if (!fitted.includes('overflow')) return fitted
  // The menu sits at the start of the line: the windows share what is left
  return fitInRoom(wanted, room - OVERFLOW_MENU_WIDTH, true)
}
