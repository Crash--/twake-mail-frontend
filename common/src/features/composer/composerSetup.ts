import type { Email, EmailBodyPart, Identity, JmapClient } from 'jmap-client-ts'

import {
  joinHtmlValues,
  normalizeCid,
  plainTextToHtml
} from '@common/features/email/emailBody'

import { fromEmailHtml } from './emailHtml'
import type { InlineImageStore } from './InlineImageStore'
import {
  buildQuoteHtml,
  prefixSubject,
  type QuoteLabels,
  type QuoteMode
} from './quote'
import { signatureBlock, signatureHtml } from './signature'
import { readSnapshot, type ComposerSnapshot } from './snapshot'

/** How the quoted email goes into the editor (the two approaches of the spike) */
export type QuoteApproach = 'atom' | 'schema'

export interface ComposerParams {
  /** Email to reply to or forward */
  sourceId: string | null
  mode: QuoteMode
  approach: QuoteApproach
  /** Draft to reopen */
  draftId: string | null
  snapshotKey: string
}

export interface ComposerSetup {
  identities: Pick<
    Identity,
    'id' | 'name' | 'email' | 'htmlSignature' | 'textSignature'
  >[]
  mailboxIds: { drafts: string; sent: string }
  identityId: string | null
  to: string
  subject: string
  html: string
  draftId: string | null
  inReplyTo: string[] | null
  references: string[] | null
  restored: boolean
}

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
  'attachments'
] as const

type SourceEmail = Pick<Email, (typeof SOURCE_PROPERTIES)[number]>

function registerInlineParts(
  parts: readonly EmailBodyPart[],
  images: InlineImageStore
): void {
  for (const part of parts) {
    if (!part.cid || !part.blobId || !part.type.startsWith('image/')) continue
    images.register({
      cid: normalizeCid(part.cid),
      blobId: part.blobId,
      type: part.type,
      size: part.size,
      name: part.name ?? normalizeCid(part.cid)
    })
  }
}

function bodyHtml(email: SourceEmail): string {
  const html = joinHtmlValues(email.htmlBody, email.bodyValues)
  if (html !== '') return html
  return email.htmlBody
    .map(part => email.bodyValues[part.partId ?? '']?.value ?? '')
    .map(plainTextToHtml)
    .join('')
}

function addressList(email: SourceEmail, mode: QuoteMode): string {
  if (mode === 'forward') return ''
  const recipients = email.replyTo?.length ? email.replyTo : email.from
  return (recipients ?? []).map(address => address.email).join(', ')
}

async function loadEmail(
  client: JmapClient,
  accountId: string,
  id: string
): Promise<SourceEmail> {
  const response = await client.call('Email/get', {
    accountId,
    ids: [id],
    properties: [...SOURCE_PROPERTIES],
    fetchHTMLBodyValues: true
  })
  const email = response.list[0]
  if (!email) throw new Error(`Email ${id} not found`)
  return email
}

function restoreFromSnapshot(
  snapshot: ComposerSnapshot,
  images: InlineImageStore
): Pick<
  ComposerSetup,
  | 'identityId'
  | 'to'
  | 'subject'
  | 'draftId'
  | 'inReplyTo'
  | 'references'
  | 'restored'
> {
  snapshot.images.forEach(image => {
    images.register(image)
  })
  return {
    identityId: snapshot.identityId,
    to: snapshot.to,
    subject: snapshot.subject,
    draftId: snapshot.draftId,
    inReplyTo: snapshot.inReplyTo,
    references: snapshot.references,
    restored: true
  }
}

/**
 * Everything the composer needs before the editor is created: identities,
 * mailboxes, and the initial content (snapshot after a reload, reopened
 * draft, reply or forward with its quote and the signature, or a new
 * message). The images it references are downloaded.
 */
export async function loadComposerSetup(
  client: JmapClient,
  accountId: string,
  params: ComposerParams,
  images: InlineImageStore,
  quoteLabels: QuoteLabels,
  locale: string
): Promise<ComposerSetup> {
  const [identities, mailboxes] = await client.request(builder => [
    builder.call('Identity/get', {
      accountId,
      ids: null,
      properties: ['id', 'name', 'email', 'htmlSignature', 'textSignature']
    }),
    builder.call('Mailbox/get', {
      accountId,
      ids: null,
      properties: ['id', 'role']
    })
  ])
  const drafts = mailboxes.list.find(mailbox => mailbox.role === 'drafts')
  const sent = mailboxes.list.find(mailbox => mailbox.role === 'sent')
  if (!drafts || !sent) throw new Error('No Drafts or Sent mailbox')
  const identity = identities.list[0] ?? null
  const base = {
    identities: identities.list,
    mailboxIds: { drafts: drafts.id, sent: sent.id }
  }

  const snapshot = readSnapshot(params.snapshotKey)
  if (snapshot) {
    const restored = restoreFromSnapshot(snapshot, images)
    await images.downloadAll()
    return {
      ...base,
      ...restored,
      html: fromEmailHtml(snapshot.html, cid => images.urlFor(cid))
    }
  }

  if (params.draftId) {
    const draft = await loadEmail(client, accountId, params.draftId)
    registerInlineParts(draft.attachments, images)
    await images.downloadAll()
    return {
      ...base,
      identityId: identity?.id ?? null,
      to: (draft.to ?? []).map(address => address.email).join(', '),
      subject: draft.subject ?? '',
      html: fromEmailHtml(bodyHtml(draft), cid => images.urlFor(cid)),
      draftId: draft.id,
      inReplyTo: null,
      references: null,
      restored: false
    }
  }

  const signature = identity ? signatureHtml(identity) : null
  const signatureHtmlBlock = signature ? signatureBlock(signature) : ''

  if (params.sourceId) {
    const source = await loadEmail(client, accountId, params.sourceId)
    registerInlineParts(source.attachments, images)
    await images.downloadAll()
    const quote = buildQuoteHtml(
      params.mode,
      {
        receivedAt: source.receivedAt,
        subject: source.subject,
        from: source.from,
        to: source.to,
        cc: source.cc,
        bcc: source.bcc,
        replyTo: source.replyTo,
        html: bodyHtml(source)
      },
      quoteLabels,
      locale
    )
    const quoteContent =
      params.approach === 'atom'
        ? `<div data-html-block="quote">${quote}</div>`
        : fromEmailHtml(quote, cid => images.urlFor(cid))
    const messageId = source.messageId ?? []
    return {
      ...base,
      identityId: identity?.id ?? null,
      to: addressList(source, params.mode),
      subject: prefixSubject(
        source.subject,
        params.mode === 'reply' ? 'Re:' : 'Fwd:'
      ),
      // tmail-flutter: two empty lines, the signature, then the quote
      html: `<p></p><p></p>${signatureHtmlBlock}${quoteContent}`,
      draftId: null,
      inReplyTo: params.mode === 'reply' ? messageId : null,
      references:
        params.mode === 'reply'
          ? [...(source.references ?? []), ...messageId]
          : null,
      restored: false
    }
  }

  return {
    ...base,
    identityId: identity?.id ?? null,
    to: '',
    subject: '',
    html: `<p></p>${signatureHtmlBlock}`,
    draftId: null,
    inReplyTo: null,
    references: null,
    restored: false
  }
}
