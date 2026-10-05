import {
  JmapSetError,
  type EmailAddress,
  type EmailBodyPartCreate,
  type EmailCreate,
  type JmapClient,
  type SetError
} from 'jmap-client-ts'

import { findReferencedCids } from '@common/features/email/emailBody'

import { htmlToText, toEmailHtml } from './emailHtml'
import type { InlineImageStore } from './InlineImageStore'
import type { Answering } from './replyContent'

/** Header keeping the identity of a draft (tmail-flutter reads it too) */
export const IDENTITY_HEADER = 'header:X-JMAP-Identity:asText'

export interface ComposedMessage {
  /** Identity sending it, kept in the drafts (`IDENTITY_HEADER`) */
  identityId: string | null
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  bcc?: EmailAddress[]
  replyTo?: EmailAddress[]
  subject: string
  /** `editor.getHTML()` */
  editorHtml: string
  inReplyTo: string[] | null
  references: string[] | null
  /** Files attached (not shown in the body), already uploaded */
  attachments?: AttachedFile[]
}

/** An uploaded file of the message */
export interface AttachedFile {
  blobId: string
  type: string
  name: string
  size: number
}

export interface MailboxIds {
  drafts: string
  sent: string | null
}

/**
 * `data:` images (pasted, or base64 images of a quoted email, CMP-09)
 * become uploaded `cid:` parts, as tmail-flutter does when it sends.
 */
async function uploadDataImages(
  html: string,
  images: InlineImageStore
): Promise<string> {
  const sources = new Set(
    Array.from(html.matchAll(/src="(data:image\/[^"]+)"/g), match => match[1])
  )
  let result = html
  for (const source of sources) {
    if (!source) continue
    const image = await images.addDataUrl(source)
    result = result.replaceAll(`src="${source}"`, `src="cid:${image.cid}"`)
  }
  return result
}

/**
 * The JMAP Email of a message, in Drafts. `htmlBody` + `textBody` +
 * inline `attachments` (not `bodyStructure`: tmail-backend 1.0.21 ignores
 * it on creation) give multipart/related[multipart/alternative[text, html],
 * images].
 */
export async function buildEmail(
  message: ComposedMessage,
  images: InlineImageStore,
  mailboxIds: MailboxIds
): Promise<EmailCreate> {
  const html = await uploadDataImages(toEmailHtml(message.editorHtml), images)
  return {
    mailboxIds: { [mailboxIds.drafts]: true },
    keywords: { $draft: true, $seen: true },
    from: [message.from],
    to: message.to,
    cc: message.cc ?? [],
    bcc: message.bcc ?? [],
    replyTo: message.replyTo?.length ? message.replyTo : null,
    subject: message.subject,
    ...(message.identityId === null
      ? {}
      : { [IDENTITY_HEADER]: message.identityId }),
    inReplyTo: message.inReplyTo,
    references: message.references,
    bodyValues: {
      html: { value: html },
      text: { value: htmlToText(html) }
    },
    htmlBody: [{ partId: 'html', type: 'text/html' }],
    textBody: [{ partId: 'text', type: 'text/plain' }],
    attachments: [
      ...images.attachmentsFor(findReferencedCids(html)),
      ...(message.attachments ?? []).map((file): EmailBodyPartCreate => ({
        blobId: file.blobId,
        type: file.type,
        name: file.name,
        disposition: 'attachment'
      }))
    ]
  }
}

export interface SaveResult {
  emailId: string
  /** The files of the saved version, which now live in its own parts */
  attachments: {
    blobId: string | null
    name: string | null
    disposition: string | null
  }[]
  /**
   * Previous versions still on the server (their destruction failed): to
   * destroy with the next save, the sending or the deletion of the draft
   */
  leftovers: string[]
  /** Size of the JSON request, for the network cost of autosave */
  requestBytes: number
}

/** The body parts read back after a save (see `saveDraft`) */
const SAVED_BODY_PROPERTIES = [
  'partId',
  'blobId',
  'cid',
  'type',
  'size',
  'name',
  'disposition'
] as const

/**
 * Destroys previous versions of a draft, once a newer one exists. Returns
 * the ones still there: a version already gone (destroyed elsewhere,
 * `notFound`) is not one. Never throws: a version left is a duplicate in
 * Drafts, not a loss, and the next save tries again.
 */
export async function destroyPreviousVersions(
  client: JmapClient,
  accountId: string,
  ids: readonly string[]
): Promise<string[]> {
  if (ids.length === 0) return []
  try {
    const result = await client.call('Email/set', {
      accountId,
      destroy: [...ids]
    })
    const destroyed = new Set(result.destroyed ?? [])
    return ids.filter(
      id => !destroyed.has(id) && result.notDestroyed?.[id]?.type !== 'notFound'
    )
  } catch (error: unknown) {
    console.warn('Previous draft versions not destroyed', error)
    return [...ids]
  }
}

/**
 * Saves a draft. JMAP emails are immutable: a new version is created, then
 * the previous ones are destroyed, in two requests, as `sendEmail` does.
 *
 * The first request creates the new version and reads, with `Email/get` of
 * `#draft`, the blob ids of its inline images, which now live in its own
 * parts (`<emailId>_<partId>`). Only once it exists does a second request
 * destroy the previous versions (`previousIds`: the draft the composer
 * edits, and the versions an earlier save failed to destroy). One
 * `Email/set` doing both would lose the draft: JMAP runs the destroy of the
 * call even when its creation is refused (quota, `tooLarge`: `INFRA-16`).
 *
 * A refused creation throws `JmapSetError` (its `notCreated` says why) and
 * leaves the previous version as it was, its blobs still valid. A failed
 * destruction is not an error: the versions left come back in `leftovers`.
 */
export async function saveDraft(
  client: JmapClient,
  accountId: string,
  email: EmailCreate,
  previousIds: readonly string[],
  images: InlineImageStore
): Promise<SaveResult> {
  const [set, saved] = await client.request(builder => [
    builder.call('Email/set', { accountId, create: { draft: email } }),
    builder.call('Email/get', {
      accountId,
      ids: ['#draft'],
      // A body property before `attachments`: tmail-backend answers
      // serverFail otherwise (tmail-backend#2686)
      properties: ['htmlBody', 'attachments'],
      bodyProperties: [...SAVED_BODY_PROPERTIES]
    })
  ])
  const created = set.created?.draft
  if (!created) {
    throw new JmapSetError({
      notCreated: set.notCreated ?? {},
      notUpdated: {},
      notDestroyed: {}
    })
  }
  const parts = saved.list[0]?.attachments ?? []
  images.rebase(parts)
  const leftovers = await destroyPreviousVersions(
    client,
    accountId,
    previousIds.filter(id => id !== created.id)
  )
  return {
    emailId: created.id,
    attachments: parts.map(({ blobId, name, disposition }) => ({
      blobId,
      name,
      disposition
    })),
    leftovers,
    requestBytes: new TextEncoder().encode(JSON.stringify(email)).length
  }
}

/** Why a message was not sent */
export type SendFailure =
  | 'tooLarge'
  | 'overQuota'
  | 'forbiddenFrom'
  | 'invalidRecipients'
  | 'invalidArguments'
  | 'other'

export type SendResult =
  | { ok: true; emailId: string }
  | {
      ok: false
      reason: SendFailure
      /** The addresses the server refused (`invalidRecipients`) */
      invalidRecipients: string[]
      /**
       * The message created but not sent: it stays in Drafts and is now
       * the draft of the composer; null when nothing was created
       */
      draftId: string | null
      /** Previous versions of the draft still there, with `draftId` */
      leftovers: string[]
    }

const SEND_FAILURES: Record<string, SendFailure> = {
  tooLarge: 'tooLarge',
  overQuota: 'overQuota',
  forbiddenFrom: 'forbiddenFrom',
  // What tmail-backend answers instead of the forbiddenFrom of RFC 8621
  forbiddenMailFrom: 'forbiddenFrom',
  invalidRecipients: 'invalidRecipients',
  invalidArguments: 'invalidArguments'
}

function readFailure(error: SetError | undefined): {
  reason: SendFailure
  invalidRecipients: string[]
} {
  const invalid =
    error &&
    'invalidRecipients' in error &&
    Array.isArray(error.invalidRecipients)
      ? error.invalidRecipients.filter(item => typeof item === 'string')
      : []
  return {
    reason: (error ? SEND_FAILURES[error.type] : undefined) ?? 'other',
    invalidRecipients: invalid
  }
}

/**
 * Sends a message, in one request: `Email/set` creates it in Drafts, then
 * `EmailSubmission/set` submits it and, once submitted, moves it to Sent,
 * marks it seen and drops `$draft` (`onSuccessUpdateEmail`).
 *
 * The previous versions of the draft are destroyed afterwards, in their
 * own request, and only when the message was created: JMAP would run a
 * destroy of the same call even when the creation fails, losing the draft.
 * A message created but not submitted stays in Drafts in its place.
 *
 * Once sent, the email it answers gets `$answered` or `$forwarded`, in a
 * last request: tmail-flutter sets it in the sending request, even when the
 * submission fails.
 */
export async function sendEmail(
  client: JmapClient,
  accountId: string,
  identityId: string,
  email: EmailCreate,
  mailboxIds: MailboxIds,
  previousDraftIds: readonly string[],
  answering: Answering | null = null
): Promise<SendResult> {
  const [emailSet, submission] = await client.request(builder => [
    builder.call('Email/set', { accountId, create: { message: email } }),
    builder.call('EmailSubmission/set', {
      accountId,
      create: { submission: { identityId, emailId: '#message' } },
      onSuccessUpdateEmail: {
        '#submission': {
          [`mailboxIds/${mailboxIds.drafts}`]: null,
          ...(mailboxIds.sent === null
            ? {}
            : { [`mailboxIds/${mailboxIds.sent}`]: true }),
          'keywords/$draft': null,
          'keywords/$seen': true
        }
      }
    })
  ])
  const created = emailSet.created?.message
  if (!created) {
    return {
      ok: false,
      ...readFailure(emailSet.notCreated?.message),
      draftId: null,
      leftovers: [...previousDraftIds]
    }
  }
  // The new version holds everything: an old one left is no loss
  const leftovers = await destroyPreviousVersions(
    client,
    accountId,
    previousDraftIds
  )
  if (!submission.created?.submission) {
    return {
      ok: false,
      ...readFailure(submission.notCreated?.submission),
      draftId: created.id,
      leftovers
    }
  }
  if (answering !== null) {
    await client
      .call('Email/set', {
        accountId,
        update: {
          [answering.emailId]: { [`keywords/${answering.keyword}`]: true }
        }
      })
      .catch((error: unknown) => {
        // Sent all the same: only the mark of the answered email is missing
        console.warn('Answered email not marked', error)
      })
  }
  return { ok: true, emailId: created.id }
}
