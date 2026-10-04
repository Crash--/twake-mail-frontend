import { queryOptions } from '@tanstack/react-query'
import type { Email, JmapClient } from 'jmap-client-ts'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'

/** The email properties the reading view shows */
export const EMAIL_VIEW_PROPERTIES = [
  'id',
  'threadId',
  'mailboxIds',
  'keywords',
  'receivedAt',
  'subject',
  'from',
  'to',
  'cc',
  'bcc',
  'htmlBody',
  'bodyValues',
  'attachments',
  'hasAttachment'
] as const

export type EmailDetail = Pick<Email, (typeof EMAIL_VIEW_PROPERTIES)[number]>

export type EmailDetailKey = readonly ['email', string, 'detail', string]

export const emailKeys = {
  all: (accountId: string): readonly ['email', string] => ['email', accountId],
  detail: (accountId: string, emailId: string): EmailDetailKey => [
    ...emailKeys.all(accountId),
    'detail',
    emailId
  ]
}

/**
 * An email with the values of its HTML body parts (the text parts when it
 * has no HTML), or null when it does not exist (any more).
 */
export function emailQueryOptions(
  client: JmapClient,
  accountId: string,
  emailId: string
): QueryOptionsFor<EmailDetail | null, EmailDetailKey> {
  return queryOptions({
    queryKey: emailKeys.detail(accountId, emailId),
    queryFn: async ({ signal }) => {
      const response = await client.call(
        'Email/get',
        {
          accountId,
          ids: [emailId],
          properties: [...EMAIL_VIEW_PROPERTIES],
          fetchHTMLBodyValues: true
        },
        { signal }
      )
      return response.list[0] ?? null
    }
  })
}
