import {
  JmapRequestError,
  JmapSetError,
  type EmailAddress,
  type EmailBodyPartCreate,
  type EmailCreate,
  type Identity,
  type JmapClient,
  type SetError
} from 'jmap-client-ts'

import { findReferencedCids } from '@common/features/email/emailBody'
import {
  findTeamFolderByAddress,
  isPersonalMailbox,
  TEMPLATES_NAME
} from '@common/features/mailbox/mailboxTree'
import type { MailboxSummary } from '@common/features/mailbox/queries'
import { IMPORTANT_HEADER_VALUES } from '@common/features/email/importance'

import { htmlToText, toEmailHtml } from './emailHtml'
import { runExclusive, templatesLockName } from './draftLocks'
import type { InlineImageStore } from './InlineImageStore'
import type { AnswerKeyword, Answering } from './replyContent'
import type { TemplatesTarget } from './templatesFolder'

/** Header keeping the identity of a draft (tmail-flutter reads it too) */
export const IDENTITY_HEADER = 'header:X-JMAP-Identity:asText'

/**
 * Header keeping, in a draft only, the email it answers and how
 * (`$answered <emailId>`): reopened from Drafts, the answer still marks it
 * once sent. tmail-flutter forgets it.
 */
export const ANSWERING_HEADER = 'header:X-Twake-Answering:asText'

/**
 * Header naming, in a draft only, the composer that saved it. A save whose
 * answer was lost may have created a version nobody knows the id of: the
 * next save finds it by this header (`findStrayVersions`) and destroys it.
 */
const DRAFT_SESSION_NAME = 'X-Twake-Draft-Session'
export const DRAFT_SESSION_HEADER = `header:${DRAFT_SESSION_NAME}:asText`

/** Asks the recipients for a read receipt (RFC 8098), with `RETURN_PATH_HEADER` */
export const READ_RECEIPT_REQUEST_HEADER =
  'header:Disposition-Notification-To:asText'
/** tmail-flutter writes the address of the read receipts there too */
export const RETURN_PATH_HEADER = 'header:Return-Path:asText'

const ANSWER_KEYWORDS: readonly string[] = ['$answered', '$forwarded']

function isAnswerKeyword(value: string): value is AnswerKeyword {
  return ANSWER_KEYWORDS.includes(value)
}

/** The value of `ANSWERING_HEADER` */
export function formatAnswering({ keyword, emailId }: Answering): string {
  return `${keyword} ${emailId}`
}

/** What `ANSWERING_HEADER` says, null when absent or not understood */
export function parseAnswering(
  value: string | null | undefined
): Answering | null {
  const [keyword = '', emailId = '', ...rest] = (value ?? '')
    .trim()
    .split(/\s+/)
  if (rest.length > 0 || emailId === '' || !isAnswerKeyword(keyword)) {
    return null
  }
  return { keyword, emailId }
}

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
  /** The email it answers, kept in the drafts (`ANSWERING_HEADER`) */
  answering?: Answering | null
  /** The composer saving it, in the drafts (`DRAFT_SESSION_HEADER`) */
  draftSession?: string | null
  /**
   * Where to send read receipts (`Disposition-Notification-To`): the address
   * of the account, as tmail-flutter; null asks for none
   */
  readReceiptTo?: string | null
  /** Marked important: `X-Priority`, `Importance`, `Priority` */
  isImportant?: boolean
  /**
   * The Reply-To of the message sent when the user typed none: the one of
   * the identity, as tmail-flutter (`createReplyToRecipients`); drafts keep
   * only what was typed
   */
  identityReplyTo?: EmailAddress[]
}

/**
 * The Reply-To of a message sent with `identity` when the user typed none
 * (tmail-flutter `createReplyToRecipients`): the Reply-To of the identity,
 * named after it when the address has no name, else the identity itself
 */
export function identityReplyTo(
  identity: Pick<Identity, 'name' | 'email' | 'replyTo'> | undefined
): EmailAddress[] {
  if (!identity) return []
  const name = identity.name === '' ? null : identity.name
  const replyTo = identity.replyTo ?? []
  if (replyTo.length > 0) {
    return replyTo.map(address => ({
      // James leaves out a name it does not have
      name: (address.name ?? '') === '' ? name : address.name,
      email: address.email
    }))
  }
  return identity.email === '' ? [] : [{ name, email: identity.email }]
}

/**
 * What an email is built for: a version of the draft, a template, or the
 * message sent
 */
export type BuildPurpose = 'draft' | 'template' | 'send'

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
 * The Drafts and Sent folders a message goes through: the ones of the team
 * mailbox when it is sent with the identity of a team mailbox, else the
 * ones of the user (tmail-flutter `getDraftMailboxIdForComposer`,
 * `getSentMailboxIdForComposer`)
 */
export function composerMailboxIds(
  mailboxes: readonly MailboxSummary[],
  identityEmail: string | null,
  own: MailboxIds
): MailboxIds {
  if (identityEmail === null) return own
  return {
    drafts:
      findTeamFolderByAddress(mailboxes, identityEmail, 'drafts') ?? own.drafts,
    sent: findTeamFolderByAddress(mailboxes, identityEmail, 'sent') ?? own.sent
  }
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
  mailboxIds: MailboxIds,
  purpose: BuildPurpose = 'draft'
): Promise<EmailCreate> {
  const html = await uploadDataImages(toEmailHtml(message.editorHtml), images)
  const answering = purpose === 'draft' ? (message.answering ?? null) : null
  const draftSession =
    purpose === 'draft' ? (message.draftSession ?? null) : null
  const typedReplyTo = message.replyTo ?? []
  const replyTo =
    typedReplyTo.length > 0
      ? typedReplyTo
      : purpose === 'send'
        ? (message.identityReplyTo ?? [])
        : []
  const readReceiptTo = message.readReceiptTo ?? null
  return {
    mailboxIds: { [mailboxIds.drafts]: true },
    keywords: { $draft: true, $seen: true },
    from: [message.from],
    to: message.to,
    cc: message.cc ?? [],
    bcc: message.bcc ?? [],
    replyTo: replyTo.length > 0 ? replyTo : null,
    subject: message.subject,
    ...(message.identityId === null
      ? {}
      : { [IDENTITY_HEADER]: message.identityId }),
    ...(answering === null
      ? {}
      : { [ANSWERING_HEADER]: formatAnswering(answering) }),
    ...(draftSession === null ? {} : { [DRAFT_SESSION_HEADER]: draftSession }),
    ...(readReceiptTo === null || readReceiptTo === ''
      ? {}
      : {
          [READ_RECEIPT_REQUEST_HEADER]: readReceiptTo,
          [RETURN_PATH_HEADER]: readReceiptTo
        }),
    ...(message.isImportant === true ? IMPORTANT_HEADER_VALUES : {}),
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
 * The versions of a draft saved by the composer `draftSession` that it does
 * not know (`known`): made by a save whose answer was lost. Throws when the
 * server cannot tell.
 */
export async function findStrayVersions(
  client: JmapClient,
  accountId: string,
  draftsId: string,
  draftSession: string,
  known: readonly string[]
): Promise<string[]> {
  const { ids } = await client.call('Email/query', {
    accountId,
    filter: {
      inMailbox: draftsId,
      header: [DRAFT_SESSION_NAME, draftSession]
    }
  })
  return ids.filter(id => !known.includes(id))
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

export interface TemplateSaveResult {
  emailId: string
  /** The Templates folder, created by the save when there was none */
  mailboxId: string
  /** The files of the template, which now live in its own parts */
  attachments: SaveResult['attachments']
  /** The previous version, when it could not be destroyed */
  leftovers: string[]
}

/**
 * Whether an email is filed in a team mailbox, that is, seen by others: a
 * draft reopened from the Drafts of a team mailbox is shared
 */
export async function isInTeamMailbox(
  client: JmapClient,
  accountId: string,
  emailId: string
): Promise<boolean> {
  const [emails, mailboxes] = await client.request(builder => [
    builder.call('Email/get', {
      accountId,
      ids: [emailId],
      properties: ['mailboxIds']
    }),
    builder.call('Mailbox/get', {
      accountId,
      ids: null,
      properties: ['id', 'namespace']
    })
  ])
  const filedIn = Object.keys(emails.list[0]?.mailboxIds ?? {})
  const shared = new Set(
    mailboxes.list
      .filter(
        mailbox => !isPersonalMailbox({ namespace: mailbox.namespace ?? null })
      )
      .map(mailbox => mailbox.id)
  )
  return filedIn.some(id => shared.has(id))
}

/** The Templates folder `parentId` holds, found by name among its children */
async function findTemplatesMailbox(
  client: JmapClient,
  accountId: string,
  parentId: string | null
): Promise<string | null> {
  const response = await client.call('Mailbox/get', {
    accountId,
    ids: null,
    properties: ['id', 'name', 'parentId', 'role', 'namespace']
  })
  const wanted = TEMPLATES_NAME.toLowerCase()
  const found = response.list.find(mailbox => {
    const isNamed =
      mailbox.name.toLowerCase() === wanted || mailbox.role === 'templates'
    if (parentId !== null) {
      return isNamed && mailbox.parentId === parentId
    }
    // The user's own: top level, not in a team mailbox
    return (
      isNamed &&
      (mailbox.parentId ?? null) === null &&
      isPersonalMailbox({ namespace: mailbox.namespace ?? null })
    )
  })
  return found?.id ?? null
}

/**
 * Creates the Templates folder, as tmail-flutter names it, unless another
 * composer (of this tab or another) made it first. Two composers saving
 * their first template at once would each create one, the folders the
 * first one made not being known to the other yet: the creation is
 * serialised by a Web Lock, and the folders are read again once it is held,
 * before creating anything.
 */
export function ensureTemplatesMailbox(
  client: JmapClient,
  accountId: string,
  parentId: string | null
): Promise<string> {
  return runExclusive(templatesLockName(accountId, parentId), async () => {
    const existing = await findTemplatesMailbox(client, accountId, parentId)
    if (existing !== null) return existing
    const result = await client.call('Mailbox/set', {
      accountId,
      create: {
        templates: {
          name: TEMPLATES_NAME,
          isSubscribed: true,
          ...(parentId === null ? {} : { parentId })
        }
      }
    })
    const created = result.created?.templates
    if (created) return created.id
    // Refused: a server that does not take two folders of a name says one
    // is there (made by a client without Web Locks)
    const raced = await findTemplatesMailbox(client, accountId, parentId)
    if (raced !== null) return raced
    throw new JmapSetError({
      notCreated: result.notCreated ?? {},
      notUpdated: {},
      notDestroyed: {}
    })
  })
}

/**
 * Saves a message as a template (tmail-flutter "Save as template"): in the
 * Templates folder of `target` (the user's, or the one of the team mailbox
 * of the identity), created first when there is none, seen, no `$draft`.
 * Like a draft, an update is a new version, and the previous one is
 * destroyed in another request once the new one exists; the files of the
 * template are read back, as `saveDraft` does. `email` is built for the
 * `template` purpose.
 */
export async function saveTemplate(
  client: JmapClient,
  accountId: string,
  email: EmailCreate,
  target: TemplatesTarget,
  previousId: string | null,
  images: InlineImageStore
): Promise<TemplateSaveResult> {
  const mailboxId =
    target.mailboxId ??
    (await ensureTemplatesMailbox(client, accountId, target.parentId))
  const template: EmailCreate = {
    ...email,
    mailboxIds: { [mailboxId]: true },
    keywords: { $seen: true }
  }
  const [set, saved] = await client.request(builder => [
    builder.call('Email/set', { accountId, create: { template } }),
    builder.call('Email/get', {
      accountId,
      ids: ['#template'],
      // A body property before `attachments` (tmail-backend#2686)
      properties: ['htmlBody', 'attachments'],
      bodyProperties: [...SAVED_BODY_PROPERTIES]
    })
  ])
  const created = set.created?.template
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
    previousId === null || previousId === created.id ? [] : [previousId]
  )
  return {
    emailId: created.id,
    mailboxId,
    attachments: parts.map(({ blobId, name, disposition }) => ({
      blobId,
      name,
      disposition
    })),
    leftovers
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

/**
 * The request itself was refused as too large (`maxSizeRequest` of the JMAP session, 10 MB at
 * tmail-backend): the body, written twice (HTML and text) with the headers, is over it
 */
export function isRequestTooLarge(error: unknown): boolean {
  return error instanceof JmapRequestError && error.limit === 'maxSizeRequest'
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
