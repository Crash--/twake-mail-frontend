import { DOCK_GAP, DOCK_MARGIN } from './WindowDock'
import {
  DOCKED_WINDOW_WIDTH,
  MINIMIZED_WINDOW_WIDTH,
  type DockedWindowMode
} from './DockedWindow'

/**
 * The modes the windows of a dock can show in a screen `screenWidth` wide,
 * the newest first: each keeps the mode it asks for while it fits, else is
 * minimized, else is hidden (`null`). A full screen window takes no room
 * in the dock.
 */
export function fitWindows(
  wanted: readonly DockedWindowMode[],
  screenWidth: number
): (DockedWindowMode | null)[] {
  let room = screenWidth - 2 * DOCK_MARGIN
  return wanted.map(mode => {
    if (mode === 'fullscreen') return mode
    const gap = room < screenWidth - 2 * DOCK_MARGIN ? DOCK_GAP : 0
    if (mode === 'normal' && DOCKED_WINDOW_WIDTH + gap <= room) {
      room -= DOCKED_WINDOW_WIDTH + gap
      return 'normal'
    }
    if (MINIMIZED_WINDOW_WIDTH + gap <= room) {
      room -= MINIMIZED_WINDOW_WIDTH + gap
      return 'minimized'
    }
    return null
  })
}
