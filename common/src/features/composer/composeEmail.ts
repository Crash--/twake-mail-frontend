import {
  assertSetSucceeded,
  JmapSetError,
  type EmailAddress,
  type EmailCreate,
  type JmapClient
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
    attachments: images.attachmentsFor(findReferencedCids(html))
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

/**
 * Sends a message: `Email/set` (destroying the saved draft) then
 * `EmailSubmission/set`, which moves it to Sent and drops `$draft` once
 * submitted.
 */
export async function sendEmail(
  client: JmapClient,
  accountId: string,
  identityId: string,
  email: EmailCreate,
  mailboxIds: MailboxIds,
  draftId: string | null
): Promise<string> {
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
          'keywords/$draft': null
        }
      }
    }),
    // After the submission: the message may use blobs of the draft
    builder.call('Email/set', { accountId, destroy: draftId ? [draftId] : [] })
  ])
  assertSetSucceeded(emailSet)
  assertSetSucceeded(submission)
  const created = emailSet.created?.message
  if (!created) throw new Error('Email/set created no message')
  return created.id
}
