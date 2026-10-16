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

/**
 * The last tag moved between the fields of a group (dropped, or Alt + an
 * arrow), and the field that says so: the move is announced once, by it,
 * not as an address added by the field it joins
 */
export interface RecipientMove {
  group: string
  id: string
  announcer: string
}

let lastMove: RecipientMove | null = null

/** A tag moves (null: whatever the user does next is not a move) */
export function noteRecipientMove(move: RecipientMove | null): void {
  lastMove = move
}

export function lastRecipientMove(): RecipientMove | null {
  return lastMove
}

/** Focuses a tag of a field, false when the field does not have it */
export type FocusRecipientTag = (id: string) => boolean

/** The fields shown in this page, by group then by field */
const fieldsByGroup = new Map<string, Map<string, FocusRecipientTag>>()

/** A field of a group is shown: a tag moved to it can take the focus there */
export function registerRecipientField(
  group: string,
  field: string,
  focusTag: FocusRecipientTag
): () => void {
  const fields =
    fieldsByGroup.get(group) ?? new Map<string, FocusRecipientTag>()
  fields.set(field, focusTag)
  fieldsByGroup.set(group, fields)
  return () => {
    if (fields.get(field) !== focusTag) return
    fields.delete(field)
    if (fields.size === 0) fieldsByGroup.delete(group)
  }
}

/**
 * The focus follows a tag moved from the keyboard to another field of its
 * group, so the next Alt + arrow still acts on it: false when no other field
 * has it
 */
export function focusMovedRecipient(
  group: string,
  from: string,
  id: string
): boolean {
  const fields = fieldsByGroup.get(group)
  if (fields === undefined) return false
  return [...fields].some(([field, focusTag]) => field !== from && focusTag(id))
}
