import { queryOptions } from '@tanstack/react-query'
import type { Email, JmapClient } from 'jmap-client-ts'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'

import { PRIORITY_HEADERS, type PriorityHeaders } from './importance'

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
  'hasAttachment',
  'replyTo'
] as const

/** The posting address of a mailing list (RFC 2369), for "Reply to list" */
export const LIST_POST_HEADER = 'header:List-Post:asURLs'

/** Where the sender asks a read receipt to go (RFC 8098, RFC 9007) */
export const READ_RECEIPT_HEADER = 'header:Disposition-Notification-To:asText'

export type EmailDetail = Pick<
  Email,
  Exclude<(typeof EMAIL_VIEW_PROPERTIES)[number], 'replyTo'>
> &
  Partial<Pick<Email, 'replyTo'>> &
  PriorityHeaders & {
    [LIST_POST_HEADER]?: string[] | null
    [READ_RECEIPT_HEADER]?: string | null
  }

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
    queryFn: async ({ signal }): Promise<EmailDetail | null> => {
      const response = await client.call(
        'Email/get',
        {
          accountId,
          ids: [emailId],
          properties: [
            ...EMAIL_VIEW_PROPERTIES,
            LIST_POST_HEADER,
            READ_RECEIPT_HEADER,
            ...PRIORITY_HEADERS
          ],
          fetchHTMLBodyValues: true
        },
        { signal }
      )
      // SAFETY: the properties asked above, the header under its name
      const email = response.list[0] as EmailDetail | undefined
      return email ?? null
    }
  })
}
