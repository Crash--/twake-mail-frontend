import type { Session } from 'jmap-client-ts'

/**
 * The mailbox the mail screens show (tmail-flutter#4977): the user's own,
 * a mailbox delegated to them (another JMAP account of the session), or
 * one of their team mailboxes (folders of their own account, the screens
 * bound to that team mailbox only)
 */
export type MailboxView =
  | { kind: 'own' }
  | { kind: 'delegated'; accountId: string }
  | { kind: 'team'; rootId: string }

export const OWN_VIEW: MailboxView = { kind: 'own' }

/** A mailbox delegated to the user: an account of the session not theirs */
export interface DelegatedMailbox {
  accountId: string
  /** The address of its owner */
  address: string
}

/**
 * The accounts delegated to the user (James delegation extension: the
 * session lists them, `isPersonal: false`), by address
 */
export function delegatedMailboxes(session: Session): DelegatedMailbox[] {
  return Object.entries(session.accounts)
    .filter(([, account]) => !account.isPersonal)
    .map(([accountId, account]) => ({ accountId, address: account.name }))
    .sort((left, right) => left.address.localeCompare(right.address))
}

/** Per tab: another tab, or the next sign-in, opens on the user's mailbox */
const STORAGE_PREFIX = 'twake-mail-mailbox-view:'

function storageOf(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    // Storage disabled by the browser settings
    return null
  }
}

function parseView(raw: string | null): MailboxView {
  if (raw === null) return OWN_VIEW
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return OWN_VIEW
    if (
      'kind' in value &&
      value.kind === 'delegated' &&
      'accountId' in value &&
      typeof value.accountId === 'string'
    ) {
      return { kind: 'delegated', accountId: value.accountId }
    }
    if (
      'kind' in value &&
      value.kind === 'team' &&
      'rootId' in value &&
      typeof value.rootId === 'string'
    ) {
      return { kind: 'team', rootId: value.rootId }
    }
    return OWN_VIEW
  } catch {
    return OWN_VIEW
  }
}

/** The view this tab showed for `username` before a reload */
export function readMailboxView(username: string): MailboxView {
  try {
    return parseView(
      storageOf()?.getItem(`${STORAGE_PREFIX}${username}`) ?? null
    )
  } catch {
    return OWN_VIEW
  }
}

export function writeMailboxView(username: string, view: MailboxView): void {
  try {
    const storage = storageOf()
    if (view.kind === 'own') {
      storage?.removeItem(`${STORAGE_PREFIX}${username}`)
    } else {
      storage?.setItem(`${STORAGE_PREFIX}${username}`, JSON.stringify(view))
    }
  } catch {
    // Not kept: a reload shows the user's own mailbox
  }
}

/**
 * Forgets the view of every user of this tab: the next sign-in opens on
 * the user's own mailbox, whatever they showed before signing out
 */
export function clearMailboxViews(): void {
  try {
    const storage = storageOf()
    if (storage === null) return
    const keys = Array.from({ length: storage.length }, (_, index) =>
      storage.key(index)
    ).filter(key => key?.startsWith(STORAGE_PREFIX) === true)
    for (const key of keys) {
      if (key !== null) storage.removeItem(key)
    }
  } catch {
    // Nothing kept to forget
  }
}

/**
 * The view, if the session still allows it: a delegation removed meanwhile
 * gives the user's own mailbox back. A team mailbox is checked against the
 * folders, once they are loaded (`useMailboxView`).
 */
export function validMailboxView(
  view: MailboxView,
  session: Session
): MailboxView {
  if (view.kind !== 'delegated') return view
  const account = session.accounts[view.accountId]
  return account === undefined || account.isPersonal ? OWN_VIEW : view
}

/** A key that changes with the view: what it shows is remounted */
export function mailboxViewKey(view: MailboxView): string {
  switch (view.kind) {
    case 'own':
      return 'own'
    case 'delegated':
      return `delegated:${view.accountId}`
    case 'team':
      return `team:${view.rootId}`
  }
}
