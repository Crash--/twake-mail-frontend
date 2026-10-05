import type { Email, JmapClient } from 'jmap-client-ts'

import {
  findReferencedCids,
  joinHtmlValues,
  plainTextToHtml
} from '@common/features/email/emailBody'
import { normalizeCid } from '@common/features/email/sanitizeEmailHtml'
import { LIST_POST_HEADER } from '@common/features/email/queries'
import type { IdentitySummary } from '@common/features/identities/queries'

import {
  identityBcc,
  NO_SEND_OPTIONS,
  type ComposerAttachment,
  type ComposerContent,
  type SendOptions
} from './composerContent'
import type { InlineImageStore } from './InlineImageStore'
import { buildQuoteHtml, prefixSubject, type QuoteLabels } from './quote'
import { mergeRecipients } from './recipients'
import {
  replyRecipients,
  type IsSelf,
  type ReplyAction
} from './replyRecipients'
import { signatureBlock, signatureHtml } from './signature'

/** What the answer to an email is made of */
const SOURCE_PROPERTIES = [
  'id',
  'messageId',
  'references',
  'receivedAt',
  'subject',
  'from',
  'to',
  'cc',
  'bcc',
  'replyTo',
  'htmlBody',
  'bodyValues',
  'attachments',
  LIST_POST_HEADER
] as const

const SOURCE_BODY_PROPERTIES = [
  'partId',
  'blobId',
  'type',
  'size',
  'name',
  'disposition',
  'cid'
] as const

type SourceEmail = Pick<
  Email,
  | 'id'
  | 'messageId'
  | 'references'
  | 'receivedAt'
  | 'subject'
  | 'from'
  | 'to'
  | 'cc'
  | 'bcc'
  | 'replyTo'
  | 'htmlBody'
  | 'bodyValues'
  | 'attachments'
> & { [LIST_POST_HEADER]?: string[] | null }

/** The keyword the answered email gets once the answer is sent */
export type AnswerKeyword = '$answered' | '$forwarded'

/** The email a composer answers */
export interface Answering {
  emailId: string
  keyword: AnswerKeyword
}

/** The strings of an answer, in the UI language */
export interface ReplyLabels {
  quote: QuoteLabels
  replyPrefix: string
  forwardPrefix: string
}

function bodyHtml(email: SourceEmail): string {
  const html = joinHtmlValues(email.htmlBody, email.bodyValues)
  if (html !== '') return html
  return email.htmlBody
    .map(part => email.bodyValues[part.partId ?? '']?.value ?? '')
    .map(plainTextToHtml)
    .join('')
}

/**
 * Message-IDs of an answer (RFC 5322 3.6.4): a reply is `In-Reply-To` the
 * email, both reference its `References` then its `Message-ID`; a forward
 * only references it, as tmail-flutter does.
 */
export function threadHeaders(
  source: Pick<SourceEmail, 'messageId' | 'references'>,
  action: ReplyAction
): { inReplyTo: string[] | null; references: string[] | null } {
  const messageId = source.messageId ?? []
  const references = Array.from(
    new Set([...(source.references ?? []), ...messageId])
  )
  return {
    inReplyTo:
      action === 'forward' || messageId.length === 0 ? null : messageId,
    references: references.length === 0 ? null : references
  }
}

/**
 * A composer answering an email (reply, reply all, reply to list,
 * forward), as tmail-flutter opens it: the recipients of its rules, the
 * subject with the prefix of the UI language, two empty lines, the
 * signature of the default identity, then the quote. The quote keeps the
 * email's HTML (sanitized) in an HtmlBlock; its `cid:` images are
 * registered, to be sent again as inline parts. A forward also takes the
 * other files of the email (the same blobs), which the user can remove.
 */
export async function loadReplyContent(
  client: JmapClient,
  accountId: string,
  reply: { emailId: string; action: ReplyAction },
  identities: readonly IdentitySummary[],
  images: InlineImageStore,
  labels: ReplyLabels,
  locale: string,
  isSelf: IsSelf,
  options: SendOptions = NO_SEND_OPTIONS
): Promise<ComposerContent> {
  const response = await client.call('Email/get', {
    accountId,
    ids: [reply.emailId],
    properties: [...SOURCE_PROPERTIES],
    bodyProperties: [...SOURCE_BODY_PROPERTIES],
    fetchHTMLBodyValues: true
  })
  // SAFETY: the header property asked above comes back under its name
  const source = response.list[0] as SourceEmail | undefined
  if (!source) throw new Error(`Email ${reply.emailId} not found`)
  const { action } = reply
  const isForward = action === 'forward'

  const html = bodyHtml(source)
  const inline = findReferencedCids(html)
  const attachments: ComposerAttachment[] = []
  for (const part of source.attachments) {
    if (!part.blobId) continue
    const cid = part.cid ? normalizeCid(part.cid) : null
    if (cid !== null && inline.has(cid)) {
      images.register({
        cid,
        blobId: part.blobId,
        type: part.type,
        size: part.size,
        name: part.name ?? cid
      })
    } else if (isForward) {
      attachments.push({
        id: part.blobId,
        blobId: part.blobId,
        type: part.type,
        name: part.name ?? part.blobId,
        size: part.size,
        status: 'done',
        progress: 100
      })
    }
  }
  await images.downloadAll()

  const quote = buildQuoteHtml(
    isForward ? 'forward' : 'reply',
    {
      receivedAt: source.receivedAt,
      subject: source.subject,
      from: source.from,
      to: source.to,
      cc: source.cc,
      bcc: source.bcc,
      replyTo: source.replyTo,
      html
    },
    labels.quote,
    locale
  )
  const recipients = replyRecipients(
    {
      from: source.from,
      to: source.to,
      cc: source.cc,
      bcc: source.bcc,
      replyTo: source.replyTo,
      listPost: source[LIST_POST_HEADER] ?? null
    },
    action,
    isSelf
  )
  const identity = identities[0] ?? null
  const signature = identity ? signatureHtml(identity) : null
  const bcc = mergeRecipients(recipients.bcc, identityBcc(identity))
  return {
    identityId: identity?.id ?? null,
    recipients: { ...recipients, bcc, replyTo: [] },
    shown: (['cc', 'bcc'] as const).filter(kind =>
      kind === 'bcc' ? bcc.length > 0 : recipients[kind].length > 0
    ),
    subject: isForward
      ? prefixSubject(source.subject, 'Fwd:', labels.forwardPrefix)
      : prefixSubject(source.subject, 'Re:', labels.replyPrefix),
    html: [
      '<p></p><p></p>',
      signature === null ? '' : signatureBlock(signature),
      `<div data-html-block="quote">${quote}</div>`
    ].join(''),
    attachments,
    draftId: null,
    leftovers: [],
    savedFingerprint: null,
    ...threadHeaders(source, action),
    answering: {
      emailId: source.id,
      keyword: isForward ? '$forwarded' : '$answered'
    },
    hasBlockedImages: false,
    draftSession: crypto.randomUUID(),
    mayHaveStrays: false,
    options,
    readReceiptAddress: null,
    templateId: null,
    opensOn: null
  }
}
