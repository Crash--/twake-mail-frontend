import { useCallback, useMemo } from 'react'

import { useComposer } from '@common/features/composer/ComposerProvider'
import {
  canReplyAll,
  hasListPost,
  makeIsSelf,
  type ReplyAction
} from '@common/features/composer/replyRecipients'
import { useIdentities } from '@common/features/identities/useIdentities'
import type { TranslationKey } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { LIST_POST_HEADER, type EmailDetail } from './queries'

export const REPLY_LABELS: Record<ReplyAction, TranslationKey> = {
  reply: 'emailActions.reply.reply',
  replyAll: 'emailActions.reply.replyAll',
  replyToList: 'emailActions.reply.replyToList',
  forward: 'emailActions.reply.forward'
}

/** The `data-testid` of the buttons (tmail-flutter keys, kebab-cased) */
export const REPLY_TEST_IDS: Record<ReplyAction, string> = {
  reply: 'reply-email-button',
  replyAll: 'reply-all-emails-button',
  replyToList: 'reply-to-list-email-button',
  forward: 'forward-email-button'
}

export interface ReplyOptions {
  /** The answers the email offers, in tmail-flutter's order */
  actions: ReplyAction[]
  /** Opens a composer answering the email */
  open: (action: ReplyAction) => void
}

/**
 * How an open email can be answered: "Reply all" when it reaches more than
 * one other address, "Reply to list" when it came from a mailing list
 * (`List-Post`), as tmail-flutter offers them.
 */
export function useReplyOptions(
  email: EmailDetail | null | undefined
): ReplyOptions {
  const { openComposer } = useComposer()
  const { session } = useJmapSession()
  const { data: identities = [] } = useIdentities()
  const isSelf = useMemo(
    () =>
      makeIsSelf([
        session.username,
        ...identities.map(identity => identity.email)
      ]),
    [session.username, identities]
  )
  const emailId = email?.id ?? null

  const actions = useMemo((): ReplyAction[] => {
    if (!email) return []
    const source = {
      from: email.from,
      to: email.to,
      cc: email.cc,
      bcc: email.bcc,
      replyTo: email.replyTo ?? null,
      listPost: email[LIST_POST_HEADER] ?? null
    }
    return [
      'reply',
      ...(canReplyAll(source, isSelf) ? (['replyAll'] as const) : []),
      ...(hasListPost(source) ? (['replyToList'] as const) : []),
      'forward'
    ]
  }, [email, isSelf])

  const open = useCallback(
    (action: ReplyAction): void => {
      if (emailId !== null) openComposer({ reply: { emailId, action } })
    },
    [emailId, openComposer]
  )

  return { actions, open }
}
