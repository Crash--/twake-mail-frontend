import type { DragEvent } from 'react'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

/** Type of a chip dragged out of a `RecipientField` */
export const RECIPIENT_DRAG_TYPE = 'application/x-twake-recipient'

/** The chip being dragged: its field, and the group of fields it may go to */
export interface RecipientDrag {
  group: string
  field: string
  id: string
}

/**
 * The chip being dragged in this page. `dataTransfer` can only be read on
 * drop: while dragging over a field, this says whether it may land there.
 */
let current: RecipientDrag | null = null

export function currentRecipientDrag(): RecipientDrag | null {
  return current
}

/**
 * Starts dragging a chip: what it carries, and under the pointer a copy of
 * the chip as tmail-flutter draws a dragged tag (blue, white text)
 */
export function startRecipientDrag(
  event: DragEvent<HTMLElement>,
  drag: RecipientDrag
): void {
  current = drag
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData(RECIPIENT_DRAG_TYPE, JSON.stringify(drag))
  const chip = event.currentTarget
  const ghost = chip.cloneNode(true)
  if (!(ghost instanceof HTMLElement)) return
  // A picture only: not a second tag for tests or assistive technologies
  ghost.removeAttribute('data-testid')
  ghost.setAttribute('aria-hidden', 'true')
  Object.assign(ghost.style, {
    position: 'fixed',
    top: '-1000px',
    left: '0',
    background: TMAIL.primary,
    borderColor: TMAIL.primary,
    color: '#FFFFFF'
  })
  chip.ownerDocument.body.appendChild(ghost)
  event.dataTransfer.setDragImage(ghost, 16, 16)
  window.setTimeout(() => {
    ghost.remove()
  }, 0)
}

export function endRecipientDrag(): void {
  current = null
}

/** What a dropped chip carried, null if it is not one */
export function readRecipientDrag(
  dataTransfer: DataTransfer
): RecipientDrag | null {
  try {
    const value: unknown = JSON.parse(dataTransfer.getData(RECIPIENT_DRAG_TYPE))
    if (
      typeof value === 'object' &&
      value !== null &&
      'group' in value &&
      'field' in value &&
      'id' in value &&
      typeof value.group === 'string' &&
      typeof value.field === 'string' &&
      typeof value.id === 'string'
    ) {
      return { group: value.group, field: value.field, id: value.id }
    }
  } catch {
    // Not a chip
  }
  return null
}
