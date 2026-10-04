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
 * Saves a draft: creates the new version and destroys the previous one in
 * the same `Email/set` (JMAP emails are immutable). tmail-flutter makes
 * three requests (create, destroy, get).
 */
export async function saveDraft(
  client: JmapClient,
  accountId: string,
  email: EmailCreate,
  previousId: string | null
): Promise<SaveResult> {
  const args = {
    accountId,
    create: { draft: email },
    destroy: previousId ? [previousId] : null
  }
  const response = assertSetSucceeded(await client.call('Email/set', args))
  const created = response.created?.draft
  if (!created) throw new Error('Email/set created no draft')
  return {
    emailId: created.id,
    requestBytes: new TextEncoder().encode(JSON.stringify(args)).length
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
    builder.call('Email/set', {
      accountId,
      create: { message: email },
      destroy: draftId ? [draftId] : null
    }),
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
    })
  ])
  assertSetSucceeded(emailSet)
  assertSetSucceeded(submission)
  const created = emailSet.created?.message
  if (!created) throw new Error('Email/set created no message')
  return created.id
}
