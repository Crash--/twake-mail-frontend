import {
  Attachment,
  Check,
  Dots,
  Icon,
  Trash,
  Warning
} from '@linagora/twake-icons'
import {
  Box,
  Button,
  IconButton,
  InputBase,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import { useQuery } from '@tanstack/react-query'
import type { Editor } from '@tiptap/core'
import { JmapSetError } from 'jmap-client-ts'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement
} from 'react'

import { FileDropZone } from '@/ds/FileDropZone/FileDropZone'
import { IMAGE_TYPES, RichTextEditor } from '@/ds/RichTextEditor/RichTextEditor'
import type { InlineImageAttributes } from '@/ds/RichTextEditor/inlineImage'
import { UploadList } from '@/ds/UploadList/UploadList'
import {
  useAlert,
  useChoose,
  useConfirm
} from '@common/features/confirm/ConfirmProvider'
import { buildEmailDocument } from '@common/features/email/emailBody'
import { RemoteContentBanner } from '@common/features/email/RemoteContentBanner'
import { formatSize } from '@common/features/email/formatSize'
import type { IdentitySummary } from '@common/features/identities/queries'
import { useIdentities } from '@common/features/identities/useIdentities'
import { findTemplatesMailboxId } from '@common/features/mailbox/mailboxTree'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import {
  isAlwaysRequestingReadReceipts,
  useServerSettings
} from '@common/features/settings/serverSettings'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import {
  buildEmail,
  identityReplyTo,
  destroyPreviousVersions,
  findStrayVersions,
  saveDraft,
  saveTemplate,
  sendEmail,
  type AttachedFile,
  type ComposedMessage,
  type MailboxIds,
  type SendFailure
} from './composeEmail'
import {
  fingerprint,
  loadDraftContent,
  newMessageContent,
  readSnapshot,
  restoreSnapshotContent,
  identityBcc,
  NO_SEND_OPTIONS,
  type ComposerAttachment,
  type ComposerContent,
  type ComposerSnapshot,
  type SendOptions
} from './composerContent'
import { snapshotKey } from './composerStorage'
import { findAttachmentKeywords, writtenText } from './attachmentReminder'
import { EDITOR_TEST_IDS, htmlBlockEditTestId } from './editorTestIds'
import {
  editableQuoteHtml,
  resolveCidSources,
  toStorageHtml
} from './emailHtml'
import { showBlockedImages } from './editorImages'
import { InlineImageStore } from './InlineImageStore'
import {
  RecipientsEditor,
  type RecipientKind,
  type RecipientLists
} from './RecipientsEditor'
import {
  isValidEmail,
  mergeRecipients,
  parseRecipients,
  type Recipient
} from './recipients'
import { loadReplyContent } from './replyContent'
import { makeIsSelf, type ReplyAction } from './replyRecipients'
import { replaceSignature, signatureHtml } from './signature'
import { useComposerAttachments } from './useComposerAttachments'
import { useEditorLabels } from './useEditorLabels'

/** Pause in the changes before a draft is saved */
export const AUTOSAVE_DELAY_MS = 1500

/**
 * What a composer opens: a new message, a draft of the server, or the
 * answer to an email
 */
export interface ComposerInit {
  draftId?: string
  reply?: { emailId: string; action: ReplyAction }
  /** A template of the Templates folder, opened as a new message */
  templateId?: string
}

/** What the window asks its form */
export interface ComposerFormHandle {
  /**
   * Before the window closes: saves what is pending, asks to save a
   * modified message. Resolves false when the window must stay open (the
   * user cancelled, the save failed).
   */
  requestClose: () => Promise<boolean>
  /** What a reload keeps, null before the editor exists */
  snapshot: () => ComposerSnapshot | null
  /** Puts the focus back in the message (opened again) */
  focus: () => void
}

export interface ComposerFormProps {
  composerId: string
  init: ComposerInit
  /** Takes the focus once loaded */
  autoFocus: boolean
  onTitleChange: (title: string) => void
  /** Gives the window what it asks the form */
  onReady: (handle: ComposerFormHandle) => void
  /** The draft the composer edits changed (opened, saved, sent, deleted) */
  onDraftChange: (draftId: string | null) => void
  /** Sent, or its draft deleted: the window goes */
  onDone: () => void
}

const EMPTY_INPUTS: Record<RecipientKind, string> = {
  to: '',
  cc: '',
  bcc: '',
  replyTo: ''
}

type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

const SAVE_STATE_KEYS: Record<SaveState, TranslationKey | null> = {
  idle: null,
  saving: 'composer.draft.saving',
  saved: 'composer.draft.autosaved',
  failed: 'composer.draft.notSaved'
}

const SEND_FAILURE_KEYS: Record<SendFailure, TranslationKey> = {
  tooLarge: 'composer.sendErrors.tooLarge',
  overQuota: 'composer.sendErrors.overQuota',
  forbiddenFrom: 'composer.sendErrors.forbiddenFrom',
  invalidRecipients: 'composer.sendErrors.invalidRecipients',
  invalidArguments: 'composer.sendErrors.generic',
  other: 'composer.sendErrors.generic'
}

function toAddresses(
  recipients: readonly Recipient[]
): { name: string | null; email: string }[] {
  return recipients.map(({ name, email }) => ({ name, email }))
}

function uploadedFiles(
  attachments: readonly ComposerAttachment[]
): AttachedFile[] {
  return attachments
    .filter(file => file.status === 'done')
    .map(({ blobId, type, name, size }) => ({ blobId, type, name, size }))
}

/**
 * The frame of a kept HTML block (the quoted email): its remote images,
 * backgrounds and fonts stay in the message, but are blocked here as in the
 * reader (CSP, no referrer)
 */
function buildBlockDocument(content: string): string {
  return buildEmailDocument(content, { allowRemoteContent: false })
}

/**
 * Images dropped on the body go inline, where they are dropped; other
 * files, or images dropped elsewhere, are attached
 */
function isImageDropOnBody(event: DragEvent<HTMLElement>): boolean {
  const target = event.target
  if (!(target instanceof Element)) return false
  if (target.closest('[contenteditable="true"]') === null) return false
  const items = Array.from(event.dataTransfer.items)
  return (
    items.length > 0 &&
    items.every(item => item.kind === 'file' && IMAGE_TYPES.includes(item.type))
  )
}

/** The translation key of a failed draft save */
function saveErrorKey(error: unknown): TranslationKey {
  if (error instanceof JmapSetError) {
    const types = Object.values(error.notCreated).map(setError => setError.type)
    if (types.includes('tooLarge')) return 'composer.draft.tooLarge'
    if (types.includes('overQuota')) return 'composer.draft.overQuota'
  }
  return 'composer.draft.saveFailed'
}

interface LoadedFormProps extends ComposerFormProps {
  content: ComposerContent
  identities: IdentitySummary[]
  mailboxIds: MailboxIds
  /** The Templates folder, null until "Save as template" creates it */
  templatesId: string | null
  images: InlineImageStore
}

function LoadedComposerForm({
  autoFocus,
  onTitleChange,
  onReady,
  onDraftChange,
  onDone,
  content,
  identities,
  mailboxIds,
  templatesId,
  images
}: LoadedFormProps): ReactElement {
  const { t, lang } = useI18n()
  const client = useJmapClient()
  const { accountId, session } = useJmapSession()
  const { notify } = useNotify()
  const choose = useChoose()
  const confirm = useConfirm()
  const alert = useAlert()
  const { labels, colors, fontSizes } = useEditorLabels()
  const subjectId = useId()
  const sendErrorId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [identityId, setIdentityId] = useState(content.identityId)
  const [recipients, setRecipients] = useState<RecipientLists>(
    content.recipients
  )
  const [inputs, setInputs] = useState(EMPTY_INPUTS)
  const [shown, setShown] = useState<ReadonlySet<RecipientKind>>(
    new Set(content.shown)
  )
  // An answer with its recipients opens on the text, the recipients folded
  // (tmail-flutter); otherwise in To
  const opensOnText =
    content.answering !== null &&
    content.draftId === null &&
    content.recipients.to.length > 0
  const [isCollapsed, setIsCollapsed] = useState(opensOnText)
  const [subject, setSubject] = useState(content.subject)
  const [options, setOptions] = useState<SendOptions>(content.options)
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [hasBlockedImages, setHasBlockedImages] = useState(
    content.hasBlockedImages
  )
  /** Counts the changes: each one (re)schedules an autosave */
  const [changes, setChanges] = useState(0)
  const editorRef = useRef<Editor | null>(null)
  const draftIdRef = useRef<string | null>(content.draftId)
  /** Previous versions a save failed to destroy: the next one tries again */
  const leftoversRef = useRef<string[]>(content.leftovers)
  /** The template "Save as template" replaces, if any */
  const templateIdRef = useRef(content.templateId)
  /** The Templates folder a save created, before the folders know it */
  const createdTemplatesIdRef = useRef<string | null>(null)
  /** A save lost its answer: it may have left a version (`findStrayVersions`) */
  const mayHaveStraysRef = useRef(content.mayHaveStrays)
  /** The draft was created by this composer: "Discard" may destroy it */
  const createdHereRef = useRef(false)
  /** The message as last saved (or opened): what "modified" compares to */
  const savedRef = useRef<string | null>(content.savedFingerprint)
  const savingRef = useRef<Promise<unknown>>(Promise.resolve())
  const timerRef = useRef<number | null>(null)
  const isMountedRef = useRef(false)
  const markChanged = (): void => {
    setChanges(count => count + 1)
  }
  const files = useComposerAttachments(
    content.attachments,
    () => images.totalSize(),
    markChanged
  )

  /** Recipients, with what is still typed in the fields */
  const allRecipients = (): RecipientLists => {
    const lists = { ...recipients }
    for (const kind of Object.keys(inputs) as RecipientKind[]) {
      lists[kind] = mergeRecipients(lists[kind], parseRecipients(inputs[kind]))
    }
    return lists
  }

  const fingerprintOf = (editor: Editor): string =>
    fingerprint(
      identityId,
      allRecipients(),
      subject,
      toStorageHtml(editor.getHTML()),
      files.attachments,
      options
    )

  const currentFingerprint = (): string | null => {
    const editor = editorRef.current
    return editor ? fingerprintOf(editor) : null
  }

  const composed = (editor: Editor): ComposedMessage => {
    const identity = identities.find(item => item.id === identityId)
    const lists = allRecipients()
    return {
      identityId,
      from: {
        name: identity?.name === '' ? null : (identity?.name ?? null),
        email: identity?.email ?? ''
      },
      to: toAddresses(lists.to),
      cc: toAddresses(lists.cc),
      bcc: toAddresses(lists.bcc),
      replyTo: toAddresses(lists.replyTo),
      subject,
      editorHtml: editor.getHTML(),
      inReplyTo: content.inReplyTo,
      references: content.references,
      attachments: uploadedFiles(files.attachments),
      answering: content.answering,
      draftSession: content.draftSession,
      readReceiptTo: options.requestReadReceipt
        ? (content.readReceiptAddress ?? session.username)
        : null,
      isImportant: options.isImportant,
      identityReplyTo: identityReplyTo(identity)
    }
  }

  const setDraftId = (id: string | null): void => {
    draftIdRef.current = id
    onDraftChange(id)
  }

  /** The draft and the versions left by earlier saves */
  const draftVersions = (): string[] =>
    draftIdRef.current === null
      ? [...leftoversRef.current]
      : [draftIdRef.current, ...leftoversRef.current]

  /**
   * Adds to the versions to destroy the ones a save whose answer was lost
   * may have created. Tried again next time when the server cannot tell.
   */
  const collectStrays = async (): Promise<void> => {
    if (!mayHaveStraysRef.current) return
    try {
      const strays = await findStrayVersions(
        client,
        accountId,
        mailboxIds.drafts,
        content.draftSession,
        draftVersions()
      )
      leftoversRef.current = [...leftoversRef.current, ...strays]
      mayHaveStraysRef.current = false
    } catch (error: unknown) {
      console.warn('Lost draft versions not looked for', error)
    }
  }

  /**
   * Saves the message as a draft, one save at a time (each replaces the
   * previous version, destroyed once the new one exists). An autosave
   * skips an unchanged message; a save asked for creates the draft of an
   * untouched one.
   */
  const save = (kind: 'auto' | 'manual'): Promise<boolean> => {
    const run = savingRef.current.then(async (): Promise<boolean> => {
      const editor = editorRef.current
      if (!editor) return false
      const current = fingerprintOf(editor)
      const isUnchanged = current === savedRef.current
      if (isUnchanged && (kind === 'auto' || draftIdRef.current !== null)) {
        return true
      }
      setSaveState('saving')
      await collectStrays()
      try {
        const email = await buildEmail(composed(editor), images, mailboxIds)
        const result = await saveDraft(
          client,
          accountId,
          email,
          draftVersions(),
          images
        )
        if (draftIdRef.current === null) createdHereRef.current = true
        leftoversRef.current = result.leftovers
        setDraftId(result.emailId)
        files.rebase(result.attachments)
        savedRef.current = current
        setSaveState('saved')
        return true
      } catch (error: unknown) {
        console.error(error)
        // Not refused but unanswered: it may have been created all the same
        if (!(error instanceof JmapSetError)) mayHaveStraysRef.current = true
        setSaveState('failed')
        if (kind === 'manual') {
          notify({ message: t(saveErrorKey(error)), severity: 'error' })
        }
        return false
      }
    })
    savingRef.current = run
    return run
  }

  const cancelAutosave = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  /** Waits for the save running, with none pending after it */
  const flush = async (): Promise<void> => {
    cancelAutosave()
    await savingRef.current
  }

  // The fields changed (not when they show first)
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true
      return
    }
    markChanged()
  }, [identityId, recipients, subject, options])

  // Autosave, once the user stopped changing the message
  useEffect(() => {
    if (changes === 0) return
    cancelAutosave()
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void save('auto')
    }, AUTOSAVE_DELAY_MS)
    // `save` reads the fields of the last render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changes])

  useEffect(() => cancelAutosave, [])

  const destroyDraft = async (): Promise<void> => {
    await collectStrays()
    const ids = draftVersions()
    if (ids.length === 0) return
    await client.call('Email/set', { accountId, destroy: ids })
    leftoversRef.current = []
    setDraftId(null)
  }

  /** Last try for the versions earlier saves left, as the window goes */
  const destroyLeftovers = (): void => {
    const ids = leftoversRef.current
    if (ids.length === 0) return
    void destroyPreviousVersions(client, accountId, ids)
      .then(left => {
        leftoversRef.current = left
      })
      .catch((error: unknown) => {
        console.error(error)
      })
  }

  const requestClose = async (): Promise<boolean> => {
    await flush()
    const current = currentFingerprint()
    if (current === null) return true
    if (current === savedRef.current) {
      destroyLeftovers()
      // Saved meanwhile: say so, and offer to drop a draft made here
      if (createdHereRef.current && draftIdRef.current !== null) {
        notify({
          message: t('composer.draft.saved'),
          severity: 'success',
          action: {
            label: t('composer.draft.discard'),
            onClick: () => {
              void destroyDraft().catch((error: unknown) => {
                console.error(error)
              })
            },
            'data-testid': 'composer-discard-draft-button'
          }
        })
      }
      return true
    }
    const choice = await choose({
      title: t('composer.close.title'),
      message: t('composer.close.message'),
      confirmLabel: t('composer.close.save'),
      alternativeLabel: t('composer.close.discard')
    })
    if (choice === 'cancel') return false
    if (choice === 'alternative') return true
    const saved = await save('manual')
    if (saved) {
      destroyLeftovers()
      notify({ message: t('composer.draft.saved'), severity: 'success' })
    }
    return saved
  }

  const snapshot = (): ComposerSnapshot | null => {
    const editor = editorRef.current
    if (!editor) return null
    return {
      identityId,
      recipients: allRecipients(),
      shown: [...shown],
      subject,
      html: toStorageHtml(editor.getHTML()),
      images: images.toJSON(),
      attachments: uploadedFiles(files.attachments),
      draftId: draftIdRef.current,
      leftovers: leftoversRef.current,
      savedFingerprint: savedRef.current,
      inReplyTo: content.inReplyTo,
      references: content.references,
      answering: content.answering,
      draftSession: content.draftSession,
      mayHaveStrays: mayHaveStraysRef.current,
      options,
      readReceiptAddress: content.readReceiptAddress,
      templateId: templateIdRef.current
    }
  }

  const focus = (): void => {
    editorRef.current?.commands.focus()
  }

  // The window reads the latest closures: they change with every field
  useEffect(() => {
    onReady({ requestClose, snapshot, focus })
  })

  useEffect(() => {
    onTitleChange(subject)
  }, [subject, onTitleChange])

  useEffect(() => {
    if (content.draftId !== null) onDraftChange(content.draftId)
    // The draft it opens with, once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleEditorReady = (editor: Editor): void => {
    editorRef.current = editor
    // A new message or a reopened draft: what it is now is what is saved
    savedRef.current ??= fingerprintOf(editor)
  }

  /** The remote images of a reopened draft, loaded once asked */
  const handleShowImages = (): void => {
    setHasBlockedImages(false)
    const editor = editorRef.current
    if (editor) showBlockedImages(editor)
    editor?.commands.focus()
  }

  const handleIdentityChange = (id: string): void => {
    const previous = identities.find(candidate => candidate.id === identityId)
    const next = identities.find(candidate => candidate.id === id)
    setIdentityId(id)
    if (editorRef.current && next) {
      replaceSignature(editorRef.current, signatureHtml(next))
    }
    // The Bcc of the identity goes with it (tmail-flutter)
    const left = new Set(
      identityBcc(previous).map(recipient => recipient.email.toLowerCase())
    )
    const added = identityBcc(next)
    if (left.size === 0 && added.length === 0) return
    setRecipients(current => ({
      ...current,
      bcc: mergeRecipients(
        current.bcc.filter(
          recipient => !left.has(recipient.email.toLowerCase())
        ),
        added
      )
    }))
    if (added.length > 0) setShown(current => new Set([...current, 'bcc']))
  }

  /** A "More" option switched on or off, said in a toast (tmail-flutter) */
  const handleToggleOption = (option: keyof SendOptions): void => {
    setMoreAnchor(null)
    const isOn = !options[option]
    setOptions(current => ({ ...current, [option]: isOn }))
    const messages: Record<
      keyof SendOptions,
      [TranslationKey, TranslationKey]
    > = {
      requestReadReceipt: [
        'composer.options.readReceiptEnabled',
        'composer.options.readReceiptDisabled'
      ],
      isImportant: [
        'composer.options.importantEnabled',
        'composer.options.importantDisabled'
      ]
    }
    const [enabled, disabled] = messages[option]
    notify({ message: t(isOn ? enabled : disabled), severity: 'success' })
  }

  const handleImageFiles = async (
    added: File[]
  ): Promise<InlineImageAttributes[]> => {
    const stored = await Promise.all(added.map(file => images.add(file)))
    return stored.map(image => ({
      src: image.url ?? '',
      alt: image.name,
      reference: image.cid,
      width: null
    }))
  }

  /** Leaving the recipients for the subject or the body folds them */
  const collapseRecipients = (): void => {
    const lists = allRecipients()
    setRecipients(lists)
    setInputs(EMPTY_INPUTS)
    if (lists.to.length + lists.cc.length + lists.bcc.length > 0) {
      setIsCollapsed(true)
    }
  }

  const handleOpenMore = (event: MouseEvent<HTMLElement>): void => {
    setMoreAnchor(event.currentTarget)
  }

  const handleSaveDraft = (): void => {
    setMoreAnchor(null)
    void flush()
      .then(() => save('manual'))
      .then(saved => {
        if (saved) {
          notify({ message: t('composer.draft.saved'), severity: 'success' })
        }
      })
  }

  /**
   * "Save as template" (tmail-flutter): the message goes to Templates,
   * replacing the template it was opened from or last saved as. It is
   * kept there: the drafts this composer made of it go, and closing it asks
   * nothing until it changes again.
   */
  const handleSaveTemplate = (): void => {
    setMoreAnchor(null)
    cancelAutosave()
    const run = savingRef.current.then(async (): Promise<void> => {
      const editor = editorRef.current
      if (!editor) return
      const previous = templateIdRef.current
      try {
        const email = await buildEmail(
          composed(editor),
          images,
          mailboxIds,
          'template'
        )
        const result = await saveTemplate(
          client,
          accountId,
          email,
          templatesId ?? createdTemplatesIdRef.current,
          previous,
          images
        )
        createdTemplatesIdRef.current = result.mailboxId
        templateIdRef.current = result.emailId
        files.rebase(result.attachments)
        savedRef.current = fingerprintOf(editor)
        setSaveState('idle')
        if (createdHereRef.current) {
          createdHereRef.current = false
          await destroyDraft().catch((error: unknown) => {
            console.warn('Drafts of a template not destroyed', error)
          })
        }
        notify({
          message: t(
            previous === null
              ? 'composer.template.saved'
              : 'composer.template.updated'
          ),
          severity: 'success'
        })
      } catch (error: unknown) {
        console.error(error)
        notify({ message: t('composer.template.failed'), severity: 'error' })
      }
    })
    savingRef.current = run
  }

  const handleDeleteDraft = (): void => {
    cancelAutosave()
    void savingRef.current
      .then(destroyDraft)
      .then(() => {
        notify({ message: t('composer.draft.deleted') })
        onDone()
      })
      .catch((error: unknown) => {
        console.error(error)
        notify({ message: t('common.errorOccurred'), severity: 'error' })
      })
  }

  const handlePickFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    const picked = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (picked.length > 0) files.addFiles(picked)
  }

  /** Whether the message can go: the checks of tmail-flutter, in its order */
  const checkBeforeSending = async (
    lists: RecipientLists
  ): Promise<boolean> => {
    if (lists.to.length + lists.cc.length + lists.bcc.length === 0) {
      await alert({
        title: t('composer.sendChecks.failedTitle'),
        message: t('composer.sendChecks.noRecipient'),
        confirmLabel: t('composer.sendChecks.addRecipients')
      })
      setIsCollapsed(false)
      return false
    }
    const all = [...lists.to, ...lists.cc, ...lists.bcc, ...lists.replyTo]
    if (all.some(recipient => !isValidEmail(recipient.email))) {
      await alert({
        title: t('composer.sendChecks.failedTitle'),
        message: t('composer.sendChecks.invalid'),
        confirmLabel: t('composer.sendChecks.fixAddresses')
      })
      setIsCollapsed(false)
      return false
    }
    if (files.isUploading) {
      await alert({
        title: t('composer.sendChecks.failedTitle'),
        message: t('composer.sendChecks.uploading'),
        confirmLabel: t('composer.gotIt')
      })
      return false
    }
    if (
      subject.trim() === '' &&
      !(await confirm({
        title: t('composer.sendChecks.emptySubjectTitle'),
        message: t('composer.sendChecks.emptySubject'),
        confirmLabel: t('composer.sendChecks.sendAnyway')
      }))
    ) {
      return false
    }
    return checkAttachmentReminder()
  }

  /**
   * A message saying a file is attached, without any: asks before sending
   * (tmail-flutter `validateAttachmentReminder`). Inline images are no
   * attachment; the quote and the signature are not read.
   */
  const checkAttachmentReminder = async (): Promise<boolean> => {
    const editor = editorRef.current
    if (!editor || files.attachments.length > 0) return true
    const keywords = findAttachmentKeywords(
      writtenText(subject, editor.getHTML())
    )
    if (keywords.length === 0) return true
    return confirm({
      title: t('composer.attachmentReminder.title'),
      message: t('composer.attachmentReminder.message', {
        keyword: keywords.map(keyword => `"${keyword}"`).join(', ')
      }),
      confirmLabel: t('composer.attachmentReminder.send')
    })
  }

  const handleSend = async (): Promise<void> => {
    const editor = editorRef.current
    const identity = identities.find(item => item.id === identityId)
    if (!editor || !identity || isSending) return
    setSendError(null)
    const lists = allRecipients()
    setRecipients(lists)
    setInputs(EMPTY_INPUTS)
    if (!(await checkBeforeSending(lists))) return
    setIsSending(true)
    try {
      await flush()
      await collectStrays()
      const email = await buildEmail(
        composed(editor),
        images,
        mailboxIds,
        'send'
      )
      const result = await sendEmail(
        client,
        accountId,
        identity.id,
        email,
        mailboxIds,
        draftVersions(),
        content.answering
      )
      if (result.ok) {
        leftoversRef.current = []
        setDraftId(null)
        notify({ message: t('composer.sent'), severity: 'success' })
        onDone()
        return
      }
      if (result.draftId !== null) {
        // Created but not sent: it is the draft now
        leftoversRef.current = result.leftovers
        setDraftId(result.draftId)
        savedRef.current = fingerprintOf(editor)
      }
      setSendError(
        t(SEND_FAILURE_KEYS[result.reason], {
          invalidRecipients: result.invalidRecipients.join(', ')
        })
      )
    } catch (error: unknown) {
      console.error(error)
      setSendError(t('composer.sendErrors.generic'))
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      void handleSend()
    }
  }

  const saveStateKey = SAVE_STATE_KEYS[saveState]

  return (
    <FileDropZone
      label={t('composer.attachments.dropHere')}
      onFiles={files.addFiles}
      isForChild={isImageDropOnBody}
      className="u-flex u-flex-column u-flex-auto u-ov-hidden"
      data-testid="composer-drop-zone"
    >
      {/* Ctrl+Enter sends, from any field of the message */}
      <div
        role="presentation"
        className="u-flex u-flex-column u-flex-auto u-ov-hidden"
        onKeyDown={handleKeyDown}
      >
        <Box className="u-ph-1 u-flex-shrink-0">
          {identities.length > 1 ? (
            <TextField
              select
              variant="standard"
              label={t('composer.fields.from')}
              value={identityId ?? ''}
              onChange={event => {
                handleIdentityChange(event.target.value)
              }}
              fullWidth
              size="small"
              className="u-mt-half"
              slotProps={{
                select: {
                  SelectDisplayProps: {
                    // @ts-expect-error data attributes are valid on the display
                    'data-testid': 'composer-identity-select'
                  }
                }
              }}
            >
              {identities.map(identity => (
                <MenuItem key={identity.id} value={identity.id}>
                  {identity.name === ''
                    ? identity.email
                    : `${identity.name} <${identity.email}>`}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          <RecipientsEditor
            recipients={recipients}
            onChange={(kind, list) => {
              setRecipients(current => ({ ...current, [kind]: list }))
            }}
            inputs={inputs}
            onInputChange={(kind, value) => {
              setInputs(current => ({ ...current, [kind]: value }))
            }}
            shown={shown}
            onShow={kind => {
              setShown(current => new Set([...current, kind]))
            }}
            isCollapsed={isCollapsed}
            onExpand={() => {
              setIsCollapsed(false)
            }}
            autoFocusTo={autoFocus && !opensOnText}
          />
          <Box className="u-flex u-flex-items-center">
            <Typography
              component="label"
              htmlFor={subjectId}
              variant="body2"
              className="u-pr-1"
            >
              {t('composer.fields.subject')}
            </Typography>
            <InputBase
              id={subjectId}
              value={subject}
              onChange={event => {
                setSubject(event.target.value)
              }}
              onFocus={collapseRecipients}
              fullWidth
              inputProps={{ 'data-testid': 'composer-subject-input' }}
            />
          </Box>
        </Box>
        {hasBlockedImages ? (
          <Box className="u-ph-1 u-pt-half u-flex-shrink-0">
            <RemoteContentBanner
              onShow={handleShowImages}
              onAlwaysShow={null}
            />
          </Box>
        ) : null}
        {/* Focusing the body folds the recipients, as the subject does */}
        <Box
          className="u-flex u-flex-column u-flex-auto u-ov-hidden u-ph-1"
          onFocus={event => {
            if (event.target.getAttribute('role') === 'textbox') {
              collapseRecipients()
            }
          }}
        >
          <RichTextEditor
            labels={labels}
            content={content.html}
            colors={colors}
            fontSizes={fontSizes}
            onImageFiles={handleImageFiles}
            htmlBlock={{
              buildFrameDocument: html =>
                buildBlockDocument(
                  `<div data-html-block="quote">${resolveCidSources(html, cid =>
                    images.urlFor(cid)
                  )}</div>`
                ),
              frameTitle: () => t('composer.quote.frameTitle'),
              editLabel: kind =>
                kind === 'quote' ? t('composer.quote.edit') : null,
              editableHtml: (_kind, html) =>
                editableQuoteHtml(html, cid => images.urlFor(cid)),
              editTestId: htmlBlockEditTestId
            }}
            footerBlockKinds={['signature', 'quote']}
            autoFocus={autoFocus && opensOnText}
            fill
            onReady={handleEditorReady}
            onUpdate={markChanged}
            testIds={EDITOR_TEST_IDS}
          />
        </Box>
        <Box className="u-ph-1 u-flex-shrink-0">
          <UploadList
            items={files.attachments.map(file => ({
              id: file.id,
              name: file.name,
              size: formatSize(file.size, lang),
              status: file.status,
              progress: file.progress
            }))}
            labels={{
              list: t('composer.attachments.list', {
                smart_count: files.attachments.length
              }),
              remove: name => t('composer.attachments.remove', { name }),
              progress: name => t('composer.attachments.progress', { name }),
              failed: t('composer.attachments.failed')
            }}
            onRemove={files.remove}
            status={files.status}
            testIds={{
              list: 'composer-attachments',
              item: 'composer-attachment-item',
              remove: 'composer-attachment-remove-button'
            }}
          />
          {sendError === null ? null : (
            <Typography
              id={sendErrorId}
              role="alert"
              variant="body2"
              color="textPrimary"
              className="u-pv-half u-flex u-flex-items-center"
              data-testid="composer-send-error"
            >
              <Icon icon={Warning} aria-hidden="true" className="u-mr-half" />
              {sendError}
            </Typography>
          )}
        </Box>
        <Box className="u-flex u-flex-items-center u-ph-1 u-pv-half u-flex-shrink-0">
          <Button
            variant="contained"
            onClick={() => {
              void handleSend()
            }}
            disabled={isSending}
            aria-describedby={sendError === null ? undefined : sendErrorId}
            data-testid="composer-send-button"
          >
            {isSending ? t('composer.sending') : t('composer.send')}
          </Button>
          <Tooltip title={t('composer.attachments.attach')}>
            <IconButton
              aria-label={t('composer.attachments.attach')}
              onClick={() => fileInputRef.current?.click()}
              className="u-ml-half"
              data-testid="composer-attach-file-button"
            >
              <Icon icon={Attachment} aria-hidden="true" />
            </IconButton>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={handlePickFiles}
            data-testid="composer-file-input"
          />
          <Typography
            role="status"
            variant="caption"
            color="textPrimary"
            className="u-flex-auto u-ph-1"
            data-testid="composer-save-status"
          >
            {saveStateKey === null ? '' : t(saveStateKey)}
          </Typography>
          <Tooltip title={t('composer.draft.delete')}>
            <IconButton
              aria-label={t('composer.draft.delete')}
              onClick={handleDeleteDraft}
              data-testid="composer-delete-draft-button"
            >
              <Icon icon={Trash} aria-hidden="true" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('composer.more')}>
            <IconButton
              aria-label={t('composer.more')}
              aria-haspopup="menu"
              aria-expanded={moreAnchor !== null}
              onClick={handleOpenMore}
              data-testid="composer-more-button"
            >
              <Icon icon={Dots} aria-hidden="true" />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={moreAnchor}
            open={moreAnchor !== null}
            onClose={() => {
              setMoreAnchor(null)
            }}
          >
            <MenuItem
              onClick={handleSaveDraft}
              data-testid="composer-save-draft-item"
            >
              <ListItemText inset primary={t('composer.saveAsDraft')} />
            </MenuItem>
            <MenuItem
              onClick={handleSaveTemplate}
              data-testid="composer-save-template-item"
            >
              <ListItemText inset primary={t('composer.template.save')} />
            </MenuItem>
            {(
              [
                [
                  'requestReadReceipt',
                  'composer.options.readReceipt',
                  'composer-read-receipt-item'
                ],
                [
                  'isImportant',
                  'composer.options.markAsImportant',
                  'composer-mark-important-item'
                ]
              ] as const
            ).map(([option, label, testId]) => (
              <MenuItem
                key={option}
                role="menuitemcheckbox"
                aria-checked={options[option]}
                onClick={() => {
                  handleToggleOption(option)
                }}
                data-testid={testId}
              >
                {options[option] ? (
                  <ListItemIcon>
                    <Icon icon={Check} aria-hidden="true" />
                  </ListItemIcon>
                ) : null}
                <ListItemText inset={!options[option]} primary={t(label)} />
              </MenuItem>
            ))}
          </Menu>
        </Box>
      </div>
    </FileDropZone>
  )
}

/**
 * The content of a composer window: identity, recipients, subject, body,
 * attached files and actions. It opens a new message, a draft, or what a
 * reload left. Loaded on demand with the editor (TipTap).
 */
export function ComposerForm(props: ComposerFormProps): ReactElement {
  const { t } = useI18n()
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const [images] = useState(() => new InlineImageStore(client, accountId))
  useEffect(() => () => images.dispose(), [images])
  const identities = useIdentities()
  const mailboxes = useMailboxes()
  const drafts = mailboxes.data?.find(mailbox => mailbox.role === 'drafts')
  const sent = mailboxes.data?.find(mailbox => mailbox.role === 'sent')
  const { session } = useJmapSession()
  const { lang } = useI18n()
  const { quote } = useEditorLabels()
  const serverSettings = useServerSettings()
  const { composerId, init } = props
  // Read once per composer: the key only says which one
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const content = useQuery({
    queryKey: ['composer', accountId, composerId, 'content'],
    queryFn: async (): Promise<ComposerContent> => {
      const list = identities.data ?? []
      // The preferences of the user (tmail-flutter: compose, reply, forward)
      const options: SendOptions = {
        ...NO_SEND_OPTIONS,
        requestReadReceipt: isAlwaysRequestingReadReceipts(
          serverSettings.settings ?? {}
        )
      }
      const kept = readSnapshot(snapshotKey(accountId, composerId))
      if (kept) return restoreSnapshotContent(kept, images)
      if (init.draftId !== undefined) {
        return loadDraftContent(client, accountId, init.draftId, list, images)
      }
      if (init.templateId !== undefined) {
        return loadDraftContent(
          client,
          accountId,
          init.templateId,
          list,
          images,
          { isTemplate: true }
        )
      }
      if (init.reply !== undefined) {
        return loadReplyContent(
          client,
          accountId,
          init.reply,
          list,
          images,
          {
            quote,
            replyPrefix: t('composer.prefix.reply'),
            forwardPrefix: t('composer.prefix.forward')
          },
          lang,
          makeIsSelf([
            session.username,
            ...list.map(identity => identity.email)
          ]),
          options
        )
      }
      return newMessageContent(list, options)
    },
    enabled: identities.data !== undefined && serverSettings.isSettled,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false
  })

  if (
    identities.isError ||
    mailboxes.isError ||
    content.isError ||
    (mailboxes.data && !drafts)
  ) {
    return (
      <Typography role="alert" className="u-p-1">
        {t('common.errorOccurred')}
      </Typography>
    )
  }
  if (!identities.data || !drafts || !content.data) {
    return (
      <Typography role="status" className="u-p-1">
        {t('common.loading')}
      </Typography>
    )
  }
  return (
    <LoadedComposerForm
      {...props}
      content={content.data}
      identities={identities.data}
      mailboxIds={{ drafts: drafts.id, sent: sent?.id ?? null }}
      templatesId={findTemplatesMailboxId(mailboxes.data ?? [])}
      images={images}
    />
  )
}
