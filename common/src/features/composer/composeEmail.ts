import {
  assertSetSucceeded,
  type EmailAddress,
  type EmailCreate,
  type JmapClient
} from 'jmap-client-ts'

import { findReferencedCids } from '@common/features/email/emailBody'

import { htmlToText, toEmailHtml } from './emailHtml'
import type { InlineImageStore } from './InlineImageStore'

export interface ComposedMessage {
  from: EmailAddress
  to: EmailAddress[]
  subject: string
  /** `editor.getHTML()` */
  editorHtml: string
  inReplyTo: string[] | null
  references: string[] | null
}

export interface MailboxIds {
  drafts: string
  sent: string
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
    subject: message.subject,
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

/**
 * Saves a draft. JMAP emails are immutable: create the new version, then,
 * once it exists, read the blob ids of its inline images and destroy the
 * previous version (tmail-flutter: create, destroy, get; three requests).
 *
 * - Not `create` and `destroy` in one call: tmail-backend destroys first.
 * - Not in one request: a failed creation must not destroy the previous
 *   version, and tmail-backend resolves neither `#creationId` nor
 *   `/created/<id>/id` references in `Email/get`.
 * - The new blob ids matter: the images of a reopened draft point at the
 *   parts of that draft (`<emailId>_<partId>`), which die with it.
 */
export async function saveDraft(
  client: JmapClient,
  accountId: string,
  email: EmailCreate,
  previousId: string | null,
  images: InlineImageStore
): Promise<SaveResult> {
  const created = assertSetSucceeded(
    await client.call('Email/set', { accountId, create: { draft: email } })
  ).created?.draft
  if (!created) throw new Error('Email/set created no draft')
  const [saved] = await client.request(builder => [
    builder.call('Email/get', {
      accountId,
      ids: [created.id],
      properties: ['attachments'],
      bodyProperties: ['blobId', 'cid', 'type', 'size', 'name']
    }),
    builder.call('Email/set', {
      accountId,
      destroy: previousId ? [previousId] : []
    })
  ])
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
          [`mailboxIds/${mailboxIds.sent}`]: true,
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
