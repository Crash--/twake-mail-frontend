import { File, getFileTypeIcon } from '@linagora/twake-icons'

import { extensionOf } from './attachmentPreview'

export type AttachmentIcon = ReturnType<typeof getFileTypeIcon>

const PLAIN_TEXT = 'text/plain'
// Extensions the `mime` package, used by twake-icons, types as text/plain
const PLAIN_TEXT_EXTENSIONS = new Set(['txt', 'text', 'log', 'conf', 'ini'])

function isPlainText(name: string, type: string): boolean {
  const mimeType = type.split(';')[0]?.trim().toLowerCase() ?? ''
  if (mimeType !== '') return mimeType === PLAIN_TEXT
  const extension = extensionOf(name)
  return extension !== null && PLAIN_TEXT_EXTENSIONS.has(extension)
}

/**
 * The icon of an attachment card: `getFileTypeIcon` of twake-icons, except
 * for plain text, which it draws as a Word document ("W"): a generic file.
 */
export function attachmentIcon(name: string, type: string): AttachmentIcon {
  return isPlainText(name, type) ? File : getFileTypeIcon(name, type)
}
