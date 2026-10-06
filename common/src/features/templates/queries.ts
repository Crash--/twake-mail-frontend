import { queryOptions } from '@tanstack/react-query'
import type { JmapClient } from 'jmap-client-ts'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'

/** The templates asked of each Templates folder: more is not a list to pick from */
export const TEMPLATES_LIMIT = 200

export interface TemplateSummary {
  id: string
  subject: string
  preview: string
  /** The Templates folder holding it */
  mailboxId: string
  receivedAt: string
}

export type TemplateListKey = readonly [
  'templates',
  string,
  'list',
  readonly string[]
]

export const templateKeys = {
  all: (accountId: string): readonly ['templates', string] => [
    'templates',
    accountId
  ],
  list: (accountId: string, mailboxIds: readonly string[]): TemplateListKey => [
    ...templateKeys.all(accountId),
    'list',
    mailboxIds
  ]
}

/**
 * The templates of the given Templates folders (the user's and the ones of
 * the team mailboxes they can read), newest first: per folder, `Email/query`
 * then `Email/get` of its ids by back-reference. It is read each time the
 * picker opens (`staleTime` 0): templates are saved from composers and from
 * other clients.
 */
export function templatesQueryOptions(
  client: JmapClient,
  accountId: string,
  mailboxIds: readonly string[]
): QueryOptionsFor<TemplateSummary[], TemplateListKey> {
  return queryOptions({
    queryKey: templateKeys.list(accountId, mailboxIds),
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const perFolder = await Promise.all(
        mailboxIds.map(async mailboxId => {
          const [, found] = await client.request(
            builder => {
              const query = builder.call('Email/query', {
                accountId,
                filter: { inMailbox: mailboxId },
                sort: [{ property: 'receivedAt', isAscending: false }],
                limit: TEMPLATES_LIMIT
              })
              const get = builder.call('Email/get', {
                accountId,
                '#ids': query.ref('/ids'),
                properties: ['id', 'subject', 'preview', 'receivedAt']
              })
              return [query, get]
            },
            { signal }
          )
          return found.list.map((email): TemplateSummary => ({
            id: email.id,
            subject: email.subject ?? '',
            preview: email.preview,
            mailboxId,
            receivedAt: email.receivedAt
          }))
        })
      )
      return perFolder
        .flat()
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    }
  })
}
