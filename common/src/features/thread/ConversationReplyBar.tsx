import type { ReactElement } from 'react'

import { ActionBar } from '@/ds/ActionBar/ActionBar'
import { DRAFT, hasKeyword } from '@common/features/email/keywords'
import { ReplyActions } from '@common/features/email/ReplyActions'
import { useEmail } from '@common/features/email/useEmail'
import { useI18n } from '@common/i18n/useI18n'

import type { EmailListItemData } from './queries'

function LastMessageReplyActions({
  emailId
}: {
  emailId: string
}): ReactElement {
  const { t } = useI18n()
  const query = useEmail(emailId)
  // The room of the bar is kept while the message loads
  if (query.data === null || query.data === undefined) {
    return <ActionBar label={t('emailActions.reply.label')}>{null}</ActionBar>
  }
  return <ReplyActions email={query.data} />
}

export interface ConversationReplyBarProps {
  emails: readonly EmailListItemData[]
}

/**
 * The answers to a conversation, in the bar at its bottom: they go to its
 * latest message that is not a draft. None when it has only drafts.
 */
export function ConversationReplyBar({
  emails
}: ConversationReplyBarProps): ReactElement | null {
  const latest = [...emails].reverse().find(email => !hasKeyword(email, DRAFT))
  if (latest === undefined) return null
  return <LastMessageReplyActions emailId={latest.id} />
}
