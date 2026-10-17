import type { EmailAddress } from 'jmap-client-ts'

import { formatAddress } from './addresses'

/**
 * Type of an address of an open email (its sender, a recipient) dragged to
 * a recipient field of a message being written. Lower case: the browsers
 * lower the dragged types
 */
export const ADDRESS_DRAG_TYPE = 'application/x-twake-mail-address'

/** What a dragged address carries */
export interface DraggedAddress {
  /** Display name, null for a bare address */
  name: string | null
  email: string
}

/**
 * Starts dragging an address: copied, not moved (it stays in the email),
 * and as text for whatever else takes text
 */
export function writeAddressDrag(
  dataTransfer: DataTransfer,
  address: EmailAddress
): void {
  const name = (address.name ?? '').trim()
  const dragged: DraggedAddress = {
    name: name === '' ? null : name,
    email: address.email
  }
  dataTransfer.effectAllowed = 'copy'
  dataTransfer.setData(ADDRESS_DRAG_TYPE, JSON.stringify(dragged))
  dataTransfer.setData('text/plain', formatAddress(address))
}

function isDraggedAddress(value: unknown): value is DraggedAddress {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    (value.name === null || typeof value.name === 'string') &&
    'email' in value &&
    typeof value.email === 'string' &&
    value.email !== ''
  )
}

/** The address a drop carried, null if it is not one */
export function readAddressDrag(
  dataTransfer: DataTransfer
): DraggedAddress | null {
  try {
    const value: unknown = JSON.parse(dataTransfer.getData(ADDRESS_DRAG_TYPE))
    return isDraggedAddress(value) ? value : null
  } catch {
    return null
  }
}
