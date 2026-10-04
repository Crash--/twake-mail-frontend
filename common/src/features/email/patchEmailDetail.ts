import type { EmailChanges } from '@common/features/thread/patchEmailList'

import type { EmailDetail } from './queries'

/**
 * Applies `changes` to an opened email: only its keywords and mailboxes can
 * change (the content of an email is immutable); null once destroyed.
 */
export function patchEmailDetail(
  detail: EmailDetail | null,
  { changed, destroyed }: Pick<EmailChanges, 'changed' | 'destroyed'>
): EmailDetail | null {
  if (detail === null) return null
  if (destroyed.includes(detail.id)) return null
  const update = changed.find(email => email.id === detail.id)
  return update
    ? { ...detail, keywords: update.keywords, mailboxIds: update.mailboxIds }
    : detail
}
