import type { Email, EmailAddress, JmapClient } from 'jmap-client-ts'

import {
  findReferencedCids,
  joinHtmlValues,
  plainTextToHtml
} from '@common/features/email/emailBody'
import type { IdentitySummary } from '@common/features/identities/queries'
import { normalizeCid } from '@common/features/email/sanitizeEmailHtml'

import {
  isMarkedImportant,
  PRIORITY_HEADERS,
  type PriorityHeaders
} from '@common/features/email/importance'

import {
  ANSWERING_HEADER,
  IDENTITY_HEADER,
  parseAnswering,
  READ_RECEIPT_REQUEST_HEADER,
  type AttachedFile
} from './composeEmail'
import { blockRemoteImages, fromEmailHtml, hasBlockedImages } from './emailHtml'
import type { InlineImageStore, StoredImage } from './InlineImageStore'
import type { Recipient } from './recipients'
import type { RecipientKind, RecipientLists } from './RecipientsEditor'
import { readStorage } from './composerStorage'
import type { Answering } from './replyContent'
import { signatureBlock, signatureHtml } from './signature'

/** A file of the message, uploaded or uploading */
export interface ComposerAttachment extends AttachedFile {
  /** Local id, for the list */
  id: string
  status: 'uploading' | 'done' | 'failed'
  /** 0 to 100 */
  progress: number
}

/** What a composer opens with, before the editor exists */
export interface ComposerContent {
  identityId: string | null
  recipients: RecipientLists
  /** The optional recipient fields shown */
  shown: RecipientKind[]
  subject: string
  /** Editor HTML, images with their display URL */
  html: string
  attachments: ComposerAttachment[]
  /** The draft on the server, null before the first save */
  draftId: string | null
  /**
   * Previous versions of the draft a save failed to destroy (see
   * `saveDraft`): the next save destroys them
   */
  leftovers: string[]
  /**
   * What the message was when last saved, or opened (`fingerprint`): null
   * until the editor computes it (a draft, a new message)
   */
  savedFingerprint: string | null
  /** Message-IDs of the email answered (`In-Reply-To`) */
  inReplyTo: string[] | null
  /** Message-IDs of the thread (`References`) */
  references: string[] | null
  /** The email answered, marked once the answer is sent; null for none */
  answering: Answering | null
  /**
   * Its remote images are kept but not loaded (a reopened draft), until
   * the user shows them
   */
  hasBlockedImages: boolean
  /** Names the composer in the versions it saves (`DRAFT_SESSION_HEADER`) */
  draftSession: string
  /**
   * A save may have created a version whose id was lost (its answer never
   * came): the next one looks for it (`findStrayVersions`)
   */
  mayHaveStrays: boolean
  /** "Request read receipt" and "Mark as important" of the "More" menu */
  options: SendOptions
  /**
   * Where read receipts go: the sender of a reopened draft (tmail-flutter);
   * null for the account address
   */
  readReceiptAddress: string | null
  /**
   * The template the message was opened from, or last saved as: "Save as
   * template" replaces it
   */
  templateId: string | null
}

/** The options of the "More" menu of a message */
export interface SendOptions {
  requestReadReceipt: boolean
  isImportant: boolean
}

export const NO_SEND_OPTIONS: SendOptions = {
  requestReadReceipt: false,
  isImportant: false
}

/**
 * The Bcc of an identity, added to the messages it sends when it is
 * chosen (tmail-flutter `_applyBccEmailAddressFromIdentity`)
 */
export function identityBcc(
  identity: Pick<IdentitySummary, 'bcc'> | null | undefined
): Recipient[] {
  return toRecipients(identity?.bcc)
}

/** What makes two states of a message different */
export function fingerprint(
  identityId: string | null,
  recipients: RecipientLists,
  subject: string,
  storageHtml: string,
  attachments: readonly Pick<ComposerAttachment, 'id' | 'status'>[],
  options: SendOptions = NO_SEND_OPTIONS
): string {
  return JSON.stringify([
    identityId,
    recipients,
    subject,
    storageHtml,
    options.requestReadReceipt,
    options.isImportant,
    // Their local ids: a save moves their blobs, not the files
    attachments
      .filter(attachment => attachment.status === 'done')
      .map(attachment => attachment.id)
  ])
}

export const EMPTY_RECIPIENTS: RecipientLists = {
  to: [],
  cc: [],
  bcc: [],
  replyTo: []
}

/**
 * A new message: the signature of the default identity, below a line, and
 * its Bcc; `options` are the preferences of the user (read receipts)
 */
export function newMessageContent(
  identities: readonly IdentitySummary[],
  options: SendOptions = NO_SEND_OPTIONS
): ComposerContent {
  const identity = identities[0] ?? null
  const signature = identity ? signatureHtml(identity) : null
  const bcc = identityBcc(identity)
  return {
    identityId: identity?.id ?? null,
    recipients: { ...EMPTY_RECIPIENTS, bcc },
    shown: bcc.length > 0 ? ['bcc'] : [],
    subject: '',
    html: `<p></p>${signature === null ? '' : signatureBlock(signature)}`,
    attachments: [],
    draftId: null,
    leftovers: [],
    savedFingerprint: null,
    inReplyTo: null,
    references: null,
    answering: null,
    hasBlockedImages: false,
    draftSession: crypto.randomUUID(),
    mayHaveStrays: false,
    options,
    readReceiptAddress: null,
    templateId: null
  }
}

/**
 * The properties of a draft the composer reads. A body property comes
 * before `attachments`: tmail-backend answers serverFail otherwise
 * (tmail-backend#2686), and past four properties the order it uses is not
 * this one: this exact list is checked by the end to end tests.
 */
export const DRAFT_PROPERTIES = [
  'htmlBody',
  'textBody',
  'bodyValues',
  'attachments',
  'subject',
  'from',
  'to',
  'cc',
  'bcc',
  'replyTo',
  'inReplyTo',
  'references',
  'keywords',
  'mailboxIds',
  IDENTITY_HEADER,
  ANSWERING_HEADER,
  READ_RECEIPT_REQUEST_HEADER,
  ...PRIORITY_HEADERS
] as const

const DRAFT_BODY_PROPERTIES = [
  'partId',
  'blobId',
  'type',
  'size',
  'name',
  'disposition',
  'cid'
] as const

type DraftEmail = Pick<
  Email,
  | 'id'
  | 'htmlBody'
  | 'bodyValues'
  | 'attachments'
  | 'subject'
  | 'from'
  | 'to'
  | 'cc'
  | 'bcc'
  | 'replyTo'
  | 'inReplyTo'
  | 'references'
> & {
  [IDENTITY_HEADER]?: string | null
  [ANSWERING_HEADER]?: string | null
  [READ_RECEIPT_REQUEST_HEADER]?: string | null
} & PriorityHeaders

function toRecipients(
  addresses: EmailAddress[] | null | undefined
): Recipient[] {
  return (addresses ?? []).map(address => ({
    name: address.name ?? null,
    email: address.email
  }))
}

function draftHtml(email: DraftEmail): string {
  const html = joinHtmlValues(email.htmlBody, email.bodyValues)
  if (html !== '') return html
  return email.htmlBody
    .map(part => email.bodyValues[part.partId ?? '']?.value ?? '')
    .map(plainTextToHtml)
    .join('')
}

/** The identity of a draft: the one it names, else the one of its sender */
function draftIdentity(
  email: DraftEmail,
  identities: readonly IdentitySummary[]
): string | null {
  const named = (email[IDENTITY_HEADER] ?? '').trim()
  const sender = email.from?.[0]?.email.toLowerCase()
  return (
    identities.find(identity => identity.id === named)?.id ??
    identities.find(identity => identity.email.toLowerCase() === sender)?.id ??
    identities[0]?.id ??
    null
  )
}

/**
 * A draft of the server, as the composer reopens it: its inline images
 * registered and downloaded, its other files attached. A template opens
 * the same way, as a new message that "Save as template" updates
 * (tmail-flutter `editAsNewEmail` with its template id).
 */
export async function loadDraftContent(
  client: JmapClient,
  accountId: string,
  draftId: string,
  identities: readonly IdentitySummary[],
  images: InlineImageStore,
  { isTemplate = false }: { isTemplate?: boolean } = {}
): Promise<ComposerContent> {
  const response = await client.call('Email/get', {
    accountId,
    ids: [draftId],
    properties: [...DRAFT_PROPERTIES],
    bodyProperties: [...DRAFT_BODY_PROPERTIES],
    fetchHTMLBodyValues: true
  })
  // SAFETY: the header property asked above comes back under its name
  const email = response.list[0] as DraftEmail | undefined
  if (!email) throw new Error(`Draft ${draftId} not found`)
  const html = draftHtml(email)
  const inline = findReferencedCids(html)
  const attachments: ComposerAttachment[] = []
  for (const part of email.attachments) {
    const cid = part.cid ? normalizeCid(part.cid) : null
    if (cid !== null && inline.has(cid) && part.blobId) {
      images.register({
        cid,
        blobId: part.blobId,
        type: part.type,
        size: part.size,
        name: part.name ?? cid
      })
    } else if (part.blobId) {
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
  // Its remote images wait for the user, as in the reader
  const editorHtml = blockRemoteImages(
    fromEmailHtml(html, cid => images.urlFor(cid))
  )
  const recipients: RecipientLists = {
    to: toRecipients(email.to),
    cc: toRecipients(email.cc),
    bcc: toRecipients(email.bcc),
    replyTo: toRecipients(email.replyTo)
  }
  return {
    identityId: draftIdentity(email, identities),
    recipients,
    shown: (['cc', 'bcc', 'replyTo'] as const).filter(
      kind => recipients[kind].length > 0
    ),
    subject: email.subject ?? '',
    html: editorHtml,
    attachments,
    draftId: isTemplate ? null : draftId,
    leftovers: [],
    savedFingerprint: null,
    inReplyTo: email.inReplyTo ?? null,
    references: email.references ?? null,
    answering: isTemplate ? null : parseAnswering(email[ANSWERING_HEADER]),
    hasBlockedImages: hasBlockedImages(editorHtml),
    draftSession: crypto.randomUUID(),
    mayHaveStrays: false,
    options: {
      requestReadReceipt: (email[READ_RECEIPT_REQUEST_HEADER] ?? '') !== '',
      isImportant: isMarkedImportant(email)
    },
    readReceiptAddress: isTemplate ? null : (email.from?.[0]?.email ?? null),
    templateId: isTemplate ? draftId : null
  }
}

// --- kept across a reload (tmail-flutter ADR 0009 and 0112) ---------------

/** A composer as `sessionStorage` keeps it: images by Content-ID, no URL */
export interface ComposerSnapshot {
  identityId: string | null
  recipients: RecipientLists
  shown: RecipientKind[]
  subject: string
  /** Editor HTML, images in `cid:` form */
  html: string
  images: Omit<StoredImage, 'url'>[]
  /** The uploaded files only */
  attachments: AttachedFile[]
  draftId: string | null
  /** Absent from the snapshots written before it existed */
  leftovers?: string[]
  savedFingerprint: string | null
  inReplyTo?: string[] | null
  references?: string[] | null
  answering?: Answering | null
  draftSession?: string
  mayHaveStrays?: boolean
  options?: SendOptions
  readReceiptAddress?: string | null
  templateId?: string | null
}

function isSnapshot(value: unknown): value is ComposerSnapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    'html' in value &&
    typeof value.html === 'string' &&
    'recipients' in value &&
    'images' in value &&
    Array.isArray(value.images) &&
    'attachments' in value &&
    Array.isArray(value.attachments)
  )
}

export function readSnapshot(key: string): ComposerSnapshot | null {
  const value = readStorage(key)
  return isSnapshot(value) ? value : null
}

/** A composer back after a reload, its images downloaded again */
export async function restoreSnapshotContent(
  snapshot: ComposerSnapshot,
  images: InlineImageStore
): Promise<ComposerContent> {
  snapshot.images.forEach(image => {
    images.register(image)
  })
  await images.downloadAll()
  const html = fromEmailHtml(snapshot.html, cid => images.urlFor(cid))
  return {
    identityId: snapshot.identityId,
    recipients: snapshot.recipients,
    shown: snapshot.shown,
    subject: snapshot.subject,
    html,
    attachments: snapshot.attachments.map(file => ({
      ...file,
      id: file.blobId,
      status: 'done',
      progress: 100
    })),
    draftId: snapshot.draftId,
    leftovers: (snapshot.leftovers ?? []).filter(
      (id): id is string => typeof id === 'string'
    ),
    savedFingerprint: snapshot.savedFingerprint,
    inReplyTo: snapshot.inReplyTo ?? null,
    references: snapshot.references ?? null,
    answering: snapshot.answering ?? null,
    hasBlockedImages: hasBlockedImages(html),
    draftSession:
      typeof snapshot.draftSession === 'string'
        ? snapshot.draftSession
        : crypto.randomUUID(),
    mayHaveStrays: snapshot.mayHaveStrays === true,
    options: {
      requestReadReceipt: snapshot.options?.requestReadReceipt === true,
      isImportant: snapshot.options?.isImportant === true
    },
    readReceiptAddress:
      typeof snapshot.readReceiptAddress === 'string'
        ? snapshot.readReceiptAddress
        : null,
    templateId:
      typeof snapshot.templateId === 'string' ? snapshot.templateId : null
  }
}
