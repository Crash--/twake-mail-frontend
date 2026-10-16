/**
 * Type of an attachment of an open email dragged into a message being
 * written (`tf#2172`). Lower case: the browsers lower the dragged types
 */
export const ATTACHMENT_DRAG_TYPE = 'application/x-twake-mail-attachment'

/** What a dragged attachment carries: its blob, reused as it is */
export interface DraggedAttachment {
  /** The account of the blob: another account cannot attach it */
  accountId: string
  blobId: string
  type: string
  name: string
  size: number
  charset: string | null
}

export function writeAttachmentDrag(
  dataTransfer: DataTransfer,
  attachment: DraggedAttachment
): void {
  dataTransfer.effectAllowed = 'copy'
  dataTransfer.setData(ATTACHMENT_DRAG_TYPE, JSON.stringify(attachment))
}

function isDraggedAttachment(value: unknown): value is DraggedAttachment {
  return (
    typeof value === 'object' &&
    value !== null &&
    'accountId' in value &&
    typeof value.accountId === 'string' &&
    'blobId' in value &&
    typeof value.blobId === 'string' &&
    value.blobId !== '' &&
    'type' in value &&
    typeof value.type === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'size' in value &&
    typeof value.size === 'number' &&
    'charset' in value &&
    (value.charset === null || typeof value.charset === 'string')
  )
}

/** The attachment a drop carried, null if it is not one */
export function readAttachmentDrag(value: string): DraggedAttachment | null {
  try {
    const parsed: unknown = JSON.parse(value)
    return isDraggedAttachment(parsed) ? parsed : null
  } catch {
    return null
  }
}
