import type { Badge } from '@linagora/twake-embed'

import {
  findTeamFolderId,
  isPersonalMailbox,
  isTeamRoot
} from '@common/features/mailbox/mailboxTree'
import type { MailboxSummary } from '@common/features/mailbox/queries'

/**
 * The root of the team mailbox whose root folder is `rootId`: null when the
 * user is not one of its members (a viewer of the space has no access, ADR
 * 005), or when it is not the root of a team mailbox
 */
export function findTeamMailboxRoot(
  mailboxes: readonly MailboxSummary[],
  rootId: string
): MailboxSummary | null {
  return (
    mailboxes.find(mailbox => mailbox.id === rootId && isTeamRoot(mailbox)) ??
    null
  )
}

/** Whether a folder belongs to the team mailbox of `root`: its namespace */
export function isInTeamMailbox(
  mailbox: Pick<MailboxSummary, 'namespace'>,
  root: Pick<MailboxSummary, 'namespace'>
): boolean {
  return !isPersonalMailbox(mailbox) && mailbox.namespace === root.namespace
}

/**
 * The folder the facade opens on: the Inbox of the team mailbox (by name,
 * team folders have no role), else its first folder; null without access
 */
export function findTeamInboxId(
  mailboxes: readonly MailboxSummary[],
  rootId: string
): string | null {
  const root = findTeamMailboxRoot(mailboxes, rootId)
  if (root === null) return null
  return (
    findTeamFolderId(mailboxes, root.id, 'inbox') ??
    mailboxes.find(mailbox => mailbox.parentId === root.id)?.id ??
    root.id
  )
}

/** The Inboxes of every team mailbox of the user */
export function findTeamInboxIds(
  mailboxes: readonly MailboxSummary[]
): string[] {
  return mailboxes
    .filter(mailbox => isTeamRoot(mailbox))
    .flatMap(root => {
      const inbox = findTeamFolderId(mailboxes, root.id, 'inbox')
      return inbox === null ? [] : [inbox]
    })
}

/** The root of the team mailbox a folder belongs to: its resource id */
export function findTeamRootOf(
  mailboxes: readonly MailboxSummary[],
  folderId: string
): string | null {
  const folder = mailboxes.find(mailbox => mailbox.id === folderId)
  if (folder === undefined) return null
  return (
    mailboxes.find(
      mailbox => isTeamRoot(mailbox) && isInTeamMailbox(folder, mailbox)
    )?.id ?? null
  )
}

/** Bounds of a report of badges (`@linagora/twake-embed`): past them, it is dropped */
const MAX_BADGES = 1000
const MAX_BADGE_COUNT = 1_000_000

/**
 * The badges of every team mailbox of the user, for the tabs of TwakeSpace
 * and the totals of its spaces: the unread emails of its Inbox, keyed by the
 * id of its root (the resource id of the facade). A frame can still show
 * the team mailbox of another space: all of them are reported.
 */
export function findTeamMailboxBadges(
  mailboxes: readonly MailboxSummary[]
): Badge[] {
  return mailboxes
    .filter(isTeamRoot)
    .slice(0, MAX_BADGES)
    .map(root => {
      const inboxId = findTeamFolderId(mailboxes, root.id, 'inbox')
      const inbox = mailboxes.find(mailbox => mailbox.id === inboxId)
      return {
        resourceId: root.id,
        count: Math.min(inbox?.unreadEmails ?? 0, MAX_BADGE_COUNT)
      }
    })
}
