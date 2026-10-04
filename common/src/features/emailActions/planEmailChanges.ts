import type { Email } from 'jmap-client-ts'

import { SEEN, type EmailKeyword } from '@common/features/email/keywords'

/** What an action needs to know of an email: where it is, its keywords */
export type TargetEmail = Pick<Email, 'id' | 'mailboxIds' | 'keywords'>

/** What an action does to each email */
export type EmailOperation =
  | {
      kind: 'move'
      /**
       * The mailbox the email is taken out of (the folder shown); null, or a
       * mailbox the email is not in, takes it out of all its mailboxes
       */
      from: string | null
      to: string
      /** Also marks the email read (moving to Spam) */
      markSeen?: boolean
    }
  | { kind: 'keyword'; keyword: EmailKeyword; isSet: boolean }
  | { kind: 'destroy' }

/** The change of one email: its state before and after, null once destroyed */
export interface EmailChange {
  before: TargetEmail
  after: TargetEmail | null
}

/** An `Email/set` patch: `mailboxIds/<id>` and `keywords/<keyword>` paths */
export type EmailPatch = Record<string, true | null>

function withFlag(
  map: Record<string, true>,
  key: string,
  isSet: boolean
): Record<string, true> {
  if (isSet) return { ...map, [key]: true }
  const { [key]: _removed, ...rest } = map
  return rest
}

function applyOperation(
  email: TargetEmail,
  operation: EmailOperation
): TargetEmail | null {
  switch (operation.kind) {
    case 'destroy':
      return null
    case 'keyword':
      return {
        ...email,
        keywords: withFlag(email.keywords, operation.keyword, operation.isSet)
      }
    case 'move': {
      const { from, to, markSeen = false } = operation
      const sources =
        from !== null && from in email.mailboxIds
          ? [from]
          : Object.keys(email.mailboxIds)
      let mailboxIds: Record<string, true> = { ...email.mailboxIds }
      for (const source of sources) {
        mailboxIds = withFlag(mailboxIds, source, false)
      }
      return {
        ...email,
        mailboxIds: withFlag(mailboxIds, to, true),
        keywords: markSeen
          ? withFlag(email.keywords, SEEN, true)
          : email.keywords
      }
    }
  }
}

function sameKeys(
  left: Record<string, true>,
  right: Record<string, true>
): boolean {
  const leftKeys = Object.keys(left)
  return (
    leftKeys.length === Object.keys(right).length &&
    leftKeys.every(key => key in right)
  )
}

function isNoOp(change: EmailChange): boolean {
  const { before, after } = change
  return (
    after !== null &&
    sameKeys(before.mailboxIds, after.mailboxIds) &&
    sameKeys(before.keywords, after.keywords)
  )
}

/**
 * The change `operation` makes to each email; emails it would leave as they
 * are (already read, already there) are left out, as tmail-flutter does.
 */
export function planEmailChanges(
  emails: readonly TargetEmail[],
  operation: EmailOperation
): EmailChange[] {
  const seen = new Set<string>()
  return emails.flatMap(email => {
    if (seen.has(email.id)) return []
    seen.add(email.id)
    const change = { before: email, after: applyOperation(email, operation) }
    return isNoOp(change) ? [] : [change]
  })
}

/** The changes that undo `changes` (a destroyed email cannot come back) */
export function invertEmailChanges(
  changes: readonly EmailChange[]
): EmailChange[] {
  return changes.flatMap(({ before, after }) =>
    after === null ? [] : [{ before: after, after: before }]
  )
}

function diffFlags(
  prefix: string,
  before: Record<string, true>,
  after: Record<string, true>,
  patch: EmailPatch
): void {
  for (const key of Object.keys(before)) {
    if (!(key in after)) patch[`${prefix}/${key}`] = null
  }
  for (const key of Object.keys(after)) {
    if (!(key in before)) patch[`${prefix}/${key}`] = true
  }
}

/**
 * The `Email/set` patch of a change, path by path (`mailboxIds/<id>`,
 * `keywords/<keyword>`), never whole maps: changes made meanwhile by other
 * clients to the other mailboxes and keywords are kept. Null to destroy.
 */
export function toEmailPatch({
  before,
  after
}: EmailChange): EmailPatch | null {
  if (after === null) return null
  const patch: EmailPatch = {}
  diffFlags('mailboxIds', before.mailboxIds, after.mailboxIds, patch)
  diffFlags('keywords', before.keywords, after.keywords, patch)
  return patch
}
