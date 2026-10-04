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
 * Saves a draft, in one request. JMAP emails are immutable: the new
 * version is created and the previous one destroyed in the same
 * `Email/set` (tmail-backend creates first: the new version may use the
 * blobs of the old one), then `Email/get` of `#draft` reads the blob ids of
 * its inline images, which now live in its own parts
 * (`<emailId>_<partId>`): the old ones die with the old version.
 *
 * A previous version already gone (destroyed elsewhere) is not an error. A
 * failed creation is (`JmapSetError`, its `notCreated` says why), and then
 * the previous version is gone too: the composer still holds the content.
 */
export async function saveDraft(
  client: JmapClient,
  accountId: string,
  email: EmailCreate,
  previousId: string | null,
  images: InlineImageStore
): Promise<SaveResult> {
  const [set, saved] = await client.request(builder => [
    builder.call('Email/set', {
      accountId,
      create: { draft: email },
      destroy: previousId ? [previousId] : []
    }),
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
  images.rebase(saved.list[0]?.attachments ?? [])
  return {
    emailId: created.id,
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
 * The previous draft is destroyed afterwards, in its own request, and
 * only when the message was created: JMAP would run a destroy of the same
 * call even when the creation fails, losing the draft. A message created
 * but not submitted stays in Drafts in its place.
 */
export async function sendEmail(
  client: JmapClient,
  accountId: string,
  identityId: string,
  email: EmailCreate,
  mailboxIds: MailboxIds,
  previousDraftId: string | null
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
      draftId: null
    }
  }
  if (previousDraftId !== null) {
    await client
      .call('Email/set', { accountId, destroy: [previousDraftId] })
      .catch((error: unknown) => {
        // The new version holds everything: an old one left is no loss
        console.warn('Previous draft not destroyed', error)
      })
  }
  if (!submission.created?.submission) {
    return {
      ok: false,
      ...readFailure(submission.notCreated?.submission),
      draftId: created.id
    }
  }
  return { ok: true, emailId: created.id }
}
