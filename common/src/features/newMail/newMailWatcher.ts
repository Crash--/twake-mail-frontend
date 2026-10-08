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
 * Tells about the emails created in the Inbox, unread and not drafts, from
 * one pushed `Email` state to the next (`Email/changes` and the `Email/get`
 * of what was created, in one request). Never about what arrived before the
 * last `reset`, so that a reconnection does not bring a burst of alerts.
 */
export function createNewMailWatcher(
  client: JmapClient,
  accountId: string,
  inboxId: () => string | null,
  onNewEmails: (emails: readonly NewEmail[]) => void,
  /** Whether this page alerts now: else a push asks the server nothing */
  isWanted: () => boolean
): NewMailWatcher {
  let since: string | null = null
  let isClosed = false
  let queue = Promise.resolve()

  async function check(state: string): Promise<void> {
    const from = since
    const inbox = inboxId()
    if (from === null || from === state) return
    if (!isWanted()) {
      since = state
      return
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
    if (since !== from || isClosed) return
    // ponytail: a burst too big for one round is skipped, not paged
    since = changes.hasMoreChanges ? state : changes.newState
    if (changes.hasMoreChanges || inbox === null) return
    const emails = (created.list as NewEmailCandidate[])
      .filter(
        email =>
          email.mailboxIds?.[inbox] === true &&
          email.keywords?.$seen !== true &&
          email.keywords?.$draft !== true
      )
      .map(email => ({
        id: email.id,
        inboxId: inbox,
        from: email.from,
        subject: email.subject
      }))
    if (emails.length > 0) onNewEmails(emails)
  }

  return {
    reset: state => {
      since = state
    },
    pushed: state => {
      queue = queue
        .then(() => check(state))
        .catch((error: unknown) => {
          console.warn('[new mail] Cannot read the new emails', error)
          // Starts again from what the server last said
          since = state
        })
    },
    close: () => {
      isClosed = true
    }
  }
}
