import type { EmailAddress, JmapClient } from 'jmap-client-ts'

/** An email that just reached the Inbox, unread */
export interface NewEmail {
  id: string
  inboxId: string
  from: EmailAddress[] | null
  subject: string | null
}

export interface NewMailWatcher {
  /**
   * The `Email` state to start from, silently: what arrived before it is not
   * new (first opening of the push channel, reconnection). Null stops
   * watching until the next reset.
   */
  reset: (state: string | null) => void
  /** The server pushed a new `Email` state */
  pushed: (state: string) => void
  /**
   * Reads the new emails now, as the web push asks without telling a state.
   * Resolves true once they were read and told about; false when they were
   * not (not watching, request failed, too many at once).
   */
  poll: () => Promise<boolean>
  close: () => void
}

interface NewEmailCandidate {
  id: string
  mailboxIds: Record<string, boolean> | null
  keywords: Record<string, boolean> | null
  from: EmailAddress[] | null
  subject: string | null
}

/**
 * Tells about the emails created in an Inbox followed, unread and not drafts, from
 * one pushed `Email` state to the next (`Email/changes` and the `Email/get`
 * of what was created, in one request). Never about what arrived before the
 * last `reset`, so that a reconnection does not bring a burst of alerts.
 */
export function createNewMailWatcher(
  client: JmapClient,
  accountId: string,
  /** The Inboxes followed: the user's, or those of their team mailboxes */
  inboxIds: () => readonly string[],
  onNewEmails: (emails: readonly NewEmail[]) => void | Promise<void>,
  /** Whether this page alerts now: else a push asks the server nothing */
  isWanted: () => boolean
): NewMailWatcher {
  let since: string | null = null
  let isClosed = false
  let queue = Promise.resolve()

  /**
   * `state` null: asked without a pushed state (`poll`). Resolves whether
   * the emails created since the last check were read and told about.
   */
  async function check(state: string | null): Promise<boolean> {
    const from = since
    const inboxes = inboxIds()
    if (from === null) return false
    if (from === state) return true
    if (!isWanted()) {
      since = state ?? from
      return false
    }
    const [changes, created] = await client.request(builder => {
      const changesCall = builder.call('Email/changes', {
        accountId,
        sinceState: from
      })
      const getCall = builder.call('Email/get', {
        accountId,
        '#ids': changesCall.ref('/created'),
        properties: ['id', 'mailboxIds', 'keywords', 'from', 'subject']
      })
      return [changesCall, getCall]
    })
    // Reset while the request ran
    if (since !== from || isClosed) return false
    // ponytail: a burst too big for one round is skipped, not paged
    since = changes.hasMoreChanges
      ? (state ?? changes.newState)
      : changes.newState
    if (changes.hasMoreChanges) return false
    const emails = (created.list as NewEmailCandidate[]).flatMap(email => {
      const inboxId = inboxes.find(id => email.mailboxIds?.[id] === true)
      return inboxId === undefined ||
        email.keywords?.$seen === true ||
        email.keywords?.$draft === true
        ? []
        : [{ id: email.id, inboxId, from: email.from, subject: email.subject }]
    })
    if (emails.length > 0) await onNewEmails(emails)
    return true
  }

  return {
    reset: state => {
      since = state
    },
    pushed: state => {
      queue = queue
        .then(() => check(state))
        .then(() => undefined)
        .catch((error: unknown) => {
          console.warn('[new mail] Cannot read the new emails', error)
          // Starts again from what the server last said
          since = state
        })
    },
    poll: () => {
      const read = queue.then(() => check(null))
      queue = read.then(
        () => undefined,
        (error: unknown) => {
          console.warn('[new mail] Cannot read the new emails', error)
        }
      )
      return read.catch(() => false)
    },
    close: () => {
      isClosed = true
    }
  }
}
