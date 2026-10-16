import type { ComposerAttachment } from './composerContent'

/**
 * The size beyond which third party mail systems often refuse a message
 * (tmail-flutter `tf#2644`, raised from 2 MB to 10 MB by `tf#3151`)
 */
export const LARGE_MESSAGE_SIZE = 10 * 1024 * 1024

/**
 * Whether the regular attachments of a message weigh more than what other
 * mail systems generally accept: the inline images are not counted, nor
 * the files whose upload failed (they do not leave with the message)
 */
export function isLargeMessage(
  attachments: readonly Pick<ComposerAttachment, 'size' | 'status'>[]
): boolean {
  const total = attachments
    .filter(file => file.status !== 'failed')
    .reduce((sum, file) => sum + file.size, 0)
  return total > LARGE_MESSAGE_SIZE
}
