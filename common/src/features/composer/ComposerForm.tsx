import { Icon } from '@linagora/twake-icons'
import {
  Box,
  InputBase,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Typography
} from '@linagora/twake-mui'
import { useQuery } from '@tanstack/react-query'
import type { Editor } from '@tiptap/core'
import { JmapSetError } from 'jmap-client-ts'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode
} from 'react'

import {
  Attachment,
  Cancel,
  Check,
  Cross,
  Dots,
  Image as ImageIcon,
  Link as LinkIcon,
  Paperplane,
  Sparkle,
  Trash,
  Warning
} from '@/ds/FlutterIcons/FlutterIcons'
import { ActionIconButton } from '@/ds/ActionIconButton/ActionIconButton'
import { FieldLine } from '@/ds/FieldLine/FieldLine'
import {
  FileDropZone,
  ignoreFileDropsOutsideZones
} from '@/ds/FileDropZone/FileDropZone'
import { ThinProgressBar } from '@/ds/ThinProgressBar/ThinProgressBar'
import { IMAGE_TYPES, RichTextEditor } from '@/ds/RichTextEditor/RichTextEditor'
import type { InlineImageAttributes } from '@/ds/RichTextEditor/inlineImage'
import type { RichTextEditorActions } from '@/ds/RichTextEditor/types'
import { PillButton } from '@/ds/PillButton/PillButton'
import { SendingDialog } from '@/ds/SendingDialog/SendingDialog'
import {
  FormattingIcon,
  SaveDraftIcon,
  SendDisabledIcon,
  SendMobileIcon
} from '@/ds/ComposerIcons/ComposerIcons'
import { TopActionBar } from '@/ds/TopActionBar/TopActionBar'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import {
  useAlert,
  useChoose,
  useConfirm
} from '@common/features/confirm/ConfirmProvider'
import {
  DRIVE_CARD_BLOCK,
  driveCardsBlock,
  hasDriveCards
} from '@common/features/drive/driveCard'
import type { DriveFile } from '@common/features/drive/driveIntent'
import type { TemplateSummary } from '@common/features/templates/queries'
import { buildEmailDocument } from '@common/features/email/emailBody'
import { scribeEndpoint } from '@common/features/scribe/scribe'
import { useScribePreference } from '@common/features/scribe/scribePreference'
import { editorText, suggestionHtml } from '@common/features/scribe/scribeText'
import { RemoteContentBanner } from '@common/features/email/RemoteContentBanner'
import type { IdentitySummary } from '@common/features/identities/queries'
import { useIdentities } from '@common/features/identities/useIdentities'
import { useTeamMailboxRoot } from '@common/features/teamMailboxEmbed/TeamMailboxEmbedContext'
import { teamMailboxAddress } from '@common/features/mailbox/mailboxTree'
import type { MailboxSummary } from '@common/features/mailbox/queries'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useMarkUnsubscribed } from '@common/features/email/useMarkUnsubscribed'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { openPaywall } from '@common/features/paywall/openPaywall'
import { UpgradeStorageLink } from '@common/features/paywall/UpgradeStorageLink'
import { usePremiumCta } from '@common/features/paywall/usePremiumCta'
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
  isInTeamMailbox,
  isRequestTooLarge,
  saveTemplate,
  sendEmail,
  type AttachedFile,
  type ComposedMessage,
  composerMailboxIds,
  type MailboxIds,
  type SendFailure
} from './composeEmail'
import {
  fingerprint,
  loadDraftContent,
  mailtoContent,
  newMessageContent,
  restoreSnapshotContent,
  identityBcc,
  NO_SEND_OPTIONS,
  type ComposerAttachment,
  type ComposerContent,
  type ComposerSnapshot,
  type SendOptions
} from './composerContent'
import { findAttachmentKeywords, writtenText } from './attachmentReminder'
import { TemplatePicker } from './TemplatePicker'
import { chooseTemplatesTarget, templatesTargetKey } from './templatesFolder'
import { EDITOR_TEST_IDS, htmlBlockEditTestId } from './editorTestIds'
import { editableQuoteHtml, resolveCidSources } from './emailHtml'
import { showBlockedImages } from './editorImages'
import { InlineImageStore } from './InlineImageStore'
import type { MailtoFields } from './mailto'
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
import { ComposerAttachmentsList } from './ComposerAttachmentsList'
import { removeSignatures, replaceSignature, signatureHtml } from './signature'
import { DRAFT_IDLE_MS } from './draftPolicy'
import { getEditorHtml, getEditorStorageHtml } from './editorHtml'
import { EmojiButton } from './EmojiButton'
import { DriveAttachButton } from './DriveAttachButton'
import { ScribeMenu, type ScribeInput } from './ScribeMenu'
import {
  useComposerAttachments,
  useUploadLimits
} from './useComposerAttachments'
import { useEditorLabels } from './useEditorLabels'

/**
 * What a composer opens: a new message, a draft of the server, or the
 * answer to an email
 */
export interface ComposerInit {
  draftId?: string
  reply?: { emailId: string; action: ReplyAction }
  /** A template of the Templates folder, opened as a new message */
  templateId?: string
  /** A `mailto:` link opened by the app (`/mailto` route) */
  mailto?: MailtoFields
  /** An email of the server edited as a new message ("Edit as new email") */
  editAsNewEmailId?: string
  /**
   * The email this message unsubscribes from (a `mailto:` unsubscribe
   * link): it gets the `$unsubscribe` keyword once the message is sent
   */
  unsubscribeEmailId?: string
}

/** How a message left its composer: sent, or its draft deleted */
export type ComposerOutcome = 'sent' | 'discarded'

/** What the window asks its form */
export interface ComposerFormHandle {
  /**
   * Before the window closes: saves what is pending, asks to save a
   * modified message. Resolves false when the window must stay open (the
   * user cancelled, the save failed).
   */
  requestClose: () => Promise<boolean>
  /** What the browser keeps, null before the editor exists */
  snapshot: () => ComposerSnapshot | null
  /**
   * Writes the draft if the message has changes the server does not have
   * (before signing out); never rejects
   */
  saveIfUnsaved: () => Promise<void>
  /**
   * Nothing to keep: the message is as it opened and no draft exists for it
   * (a new message not typed in, a reply not touched)
   */
  isPristine: () => boolean
  /** Puts the focus back in the message (opened again) */
  focus: () => void
}

export interface ComposerFormProps {
  composerId: string
  init: ComposerInit
  /** What the browser kept of this composer (back after a reload) */
  restored?: ComposerSnapshot | null
  /** Takes the focus once loaded */
  autoFocus: boolean
  /** The message changed: the window keeps it in the browser */
  onChange?: () => void
  onTitleChange: (title: string) => void
  /** Who the message is for, as names: what tells it apart without subject */
  onRecipientsChange?: (names: string) => void
  /** Gives the window what it asks the form */
  onReady: (handle: ComposerFormHandle) => void
  /** The draft the composer edits changed (opened, saved, sent, deleted) */
  onDraftChange: (draftId: string | null) => void
  /** Sent, or its draft deleted: the window goes */
  onDone: (outcome: ComposerOutcome) => void
  /**
   * On a phone the form has the top bar of the window (no title bar): the
   * close button asks the window to close
   */
  onRequestClose?: () => void
  /** On a phone, more controls of the top bar, after the close button */
  topBarActions?: ReactNode
  /**
   * Closed with a draft made here, a toast offers to delete it; false when
   * the draft goes to another app (the intents page)
   */
  isDiscardOfferedOnClose?: boolean
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
  // Not `instanceof`: the composer may be rendered in another document
  const target = event.target as Element
  if (target.nodeType !== Node.ELEMENT_NODE) return false
  if (target.closest('[contenteditable="true"]') === null) return false
  const items = Array.from(event.dataTransfer.items)
  return (
    items.length > 0 &&
    items.every(item => item.kind === 'file' && IMAGE_TYPES.includes(item.type))
  )
}

/** The translation key of a failed draft save */
function saveErrorKey(error: unknown): TranslationKey {
  if (isRequestTooLarge(error)) return 'composer.draft.tooLarge'
  if (error instanceof JmapSetError) {
    const types = Object.values(error.notCreated).map(setError => setError.type)
    if (types.includes('tooLarge')) return 'composer.draft.tooLarge'
    if (types.includes('overQuota')) return 'composer.draft.overQuota'
  }
  return 'composer.draft.saveFailed'
}

/**
 * The translation key of a sending that threw. As tmail-flutter, the
 * connectivity is read when it fails: offline, it says so.
 */
function sendErrorKey(error: unknown): TranslationKey {
  if (!navigator.onLine) return 'composer.sendErrors.offline'
  if (isRequestTooLarge(error)) return 'composer.sendErrors.tooLarge'
  return 'composer.sendErrors.generic'
}

interface LoadedFormProps extends ComposerFormProps {
  content: ComposerContent
  identities: IdentitySummary[]
  /** The Drafts and Sent of the user: the ones of a team mailbox follow the identity */
  ownMailboxIds: MailboxIds
  mailboxes: readonly MailboxSummary[]
  images: InlineImageStore
}

function LoadedComposerForm({
  init,
  restored,
  autoFocus,
  onTitleChange,
  onRecipientsChange,
  onReady,
  onChange,
  onDraftChange,
  onDone,
  onRequestClose,
  topBarActions,
  isDiscardOfferedOnClose = true,
  content,
  identities,
  ownMailboxIds,
  mailboxes,
  images
}: LoadedFormProps): ReactElement {
  const { t } = useI18n()
  const client = useJmapClient()
  const { accountId, session } = useJmapSession()
  const { notify } = useNotify()
  const markUnsubscribed = useMarkUnsubscribed()
  const choose = useChoose()
  const confirm = useConfirm()
  const alert = useAlert()
  const { labels, colors, fontSizes, fontFamilies } = useEditorLabels()
  const isPhone = useScreenSize() === 'mobile'
  const subjectId = useId()
  const sendErrorId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorActions = useRef<RichTextEditorActions>(null)
  // As tmail-flutter: folded until "Aa" opens it
  const [isToolbarShown, setIsToolbarShown] = useState(false)
  const [identityId, setIdentityId] = useState(content.identityId)
  // The identity selector opens on request (the "From" button), unless the
  // message already has its own identity (a draft, an answer, a template,
  // another than the default): the sender must be seen
  const [isFromShown, setIsFromShown] = useState(
    identities.length > 1 &&
      (init.reply !== undefined ||
        init.draftId !== undefined ||
        init.templateId !== undefined ||
        content.identityId !== identities[0]?.id)
  )
  const fromId = useId()
  // Sent as a team mailbox, the message goes through its Drafts and Sent
  const identityEmail =
    identities.find(item => item.id === identityId)?.email ?? null
  const mailboxIds = useMemo(
    () => composerMailboxIds(mailboxes, identityEmail, ownMailboxIds),
    [mailboxes, identityEmail, ownMailboxIds]
  )
  const [recipients, setRecipients] = useState<RecipientLists>(
    content.recipients
  )
  const [inputs, setInputs] = useState(EMPTY_INPUTS)
  const [shown, setShown] = useState<ReadonlySet<RecipientKind>>(
    new Set(content.shown)
  )
  // As it was left (back after a reload); else an answer with its
  // recipients opens on the text, the recipients folded (tmail-flutter),
  // anything else in To
  const hasRecipients = content.recipients.to.length > 0
  const opensOnText =
    content.opensOn === null
      ? content.answering !== null && content.draftId === null && hasRecipients
      : content.opensOn === 'text' && hasRecipients
  const [isCollapsed, setIsCollapsed] = useState(opensOnText)
  const [subject, setSubject] = useState(content.subject)
  const [options, setOptions] = useState<SendOptions>(content.options)
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  /**
   * What the live region says of an autosave. A save asked for says it in
   * a toast: one voice for each message, never the line and the toast
   */
  const [saveAnnouncement, setSaveAnnouncement] = useState('')
  const [isSending, setIsSending] = useState(false)
  // The step tmail-flutter's sending dialog says: the email is built (its
  // images and attachments uploaded), then sent
  const [sendingStep, setSendingStep] = useState<'creating' | 'sending'>(
    'creating'
  )
  const [sendError, setSendError] = useState<string | null>(null)
  const [isSendOverQuota, setIsSendOverQuota] = useState(false)
  const premiumCta = usePremiumCta()
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
  /** The Templates folders a save created (by target), before the folders know them */
  const createdTemplatesRef = useRef(new Map<string, string>())
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
  const uploadLimits = useUploadLimits()
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
      getEditorStorageHtml(editor),
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
      editorHtml: getEditorHtml(editor),
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
      setSaveAnnouncement('')
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
        if (kind === 'auto') setSaveAnnouncement(t('composer.draft.autosaved'))
        // The browser keeps the id of the draft and what it holds
        onChange?.()
        return true
      } catch (error: unknown) {
        console.error(error)
        // Not refused but unanswered: it may have been created all the same
        if (!(error instanceof JmapSetError)) mayHaveStraysRef.current = true
        setSaveState('failed')
        if (kind === 'auto') setSaveAnnouncement(t('composer.draft.notSaved'))
        // The versions this save may have left
        onChange?.()
        if (kind === 'manual') {
          const paywallUrl =
            saveErrorKey(error) === 'composer.draft.overQuota' &&
            premiumCta.status === 'available'
              ? premiumCta.url
              : null
          notify({
            message: t(saveErrorKey(error)),
            severity: 'error',
            action:
              paywallUrl === null
                ? null
                : {
                    label: t('quota.increase'),
                    onClick: () => {
                      openPaywall(paywallUrl)
                    },
                    'data-testid': 'composer-draft-upgrade-button'
                  }
          })
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

  // Kept in the browser at once (the window debounces it), on the server
  // once the user stopped changing the message for `DRAFT_IDLE_MS`
  useEffect(() => {
    if (changes === 0) return
    onChange?.()
    cancelAutosave()
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void save('auto')
    }, DRAFT_IDLE_MS)
    // `save` reads the fields of the last render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changes])

  useEffect(() => cancelAutosave, [])

  /** What the timers and the editor call: the closures of the last render */
  const latestRef = useRef({ save, onChange })
  useEffect(() => {
    latestRef.current = { save, onChange }
  })

  /**
   * The text changed: the same scheduling as `markChanged`, without a render of the form.
   * Typing in a long message with 200 recipients or 50 files rendered every chip and every
   * file at each key (60 ms at 4 times slower CPU); the text lives in the editor, which the
   * saves read themselves, so nothing on the screen depends on it
   */
  const handleEditorUpdate = (): void => {
    latestRef.current.onChange?.()
    cancelAutosave()
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void latestRef.current.save('auto')
    }, DRAFT_IDLE_MS)
  }

  // What is typed in a recipient field, not yet a recipient: kept as well
  const inputsMountedRef = useRef(false)
  useEffect(() => {
    if (!inputsMountedRef.current) {
      inputsMountedRef.current = true
      return
    }
    onChange?.()
    // The window reads the form itself when it writes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs])

  const destroyDraft = async (): Promise<void> => {
    await collectStrays()
    const ids = draftVersions()
    if (ids.length === 0) return
    await client.call('Email/set', { accountId, destroy: ids })
    leftoversRef.current = []
    setDraftId(null)
    onChange?.()
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
      if (
        isDiscardOfferedOnClose &&
        createdHereRef.current &&
        draftIdRef.current !== null
      ) {
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
      html: getEditorStorageHtml(editor),
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
      templateId: templateIdRef.current,
      // The recipients fold once the focus leaves them for the text
      opensOn: isCollapsed ? 'text' : 'recipients'
    }
  }

  const saveIfUnsaved = async (): Promise<void> => {
    await flush()
    const current = currentFingerprint()
    if (current === null || current === savedRef.current) return
    await save('auto')
  }

  const isPristine = (): boolean => {
    const current = currentFingerprint()
    return (
      current !== null &&
      current === savedRef.current &&
      draftIdRef.current === null
    )
  }

  const focus = (): void => {
    editorRef.current?.commands.focus()
  }

  // The window reads the latest closures: they change with every field
  useEffect(() => {
    onReady({ requestClose, snapshot, isPristine, saveIfUnsaved, focus })
  })

  useEffect(() => {
    onTitleChange(subject)
  }, [subject, onTitleChange])

  const recipientNames = [...recipients.to, ...recipients.cc, ...recipients.bcc]
    .map(recipient => recipient.name ?? recipient.email)
    .join(', ')
  useEffect(() => {
    onRecipientsChange?.(recipientNames)
  }, [recipientNames, onRecipientsChange])

  useEffect(() => {
    if (content.draftId !== null) onDraftChange(content.draftId)
    // The draft it opens with, once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleEditorReady = (editor: Editor): void => {
    editorRef.current = editor
    // A new message or a reopened draft: what it is now is what is saved
    // Back from the browser without a version on the server: everything
    // typed is a change not saved (closing asks, the idle delay saves it)
    if (restored && savedRef.current === null) savedRef.current = ''
    savedRef.current ??= fingerprintOf(editor)
    if (savedRef.current !== fingerprintOf(editor)) markChanged()
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

  // As tmail-flutter: a bar at the top of the body while images go inline
  const [inlineUploads, setInlineUploads] = useState(0)
  const handleImageFiles = async (
    added: File[]
  ): Promise<InlineImageAttributes[]> => {
    setInlineUploads(count => count + 1)
    const stored = await Promise.all(
      added.map(file => images.add(file))
    ).finally(() => {
      setInlineUploads(count => count - 1)
    })
    return stored.map(image => ({
      src: image.url ?? '',
      // Empty: decorative until the author writes what the image says (the
      // name of the file says nothing to a screen reader)
      alt: '',
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
   * A draft reopened from a team mailbox is shared: saving it as a template
   * deletes it for everyone, so the user is asked. What they chose: the
   * draft goes, stays, or nothing is saved.
   */
  const askAboutDraft = async (): Promise<'delete' | 'keep' | 'cancel'> => {
    const draftId = draftIdRef.current
    // Made here, it is the working copy of this message
    if (draftId === null || createdHereRef.current) return 'delete'
    const isShared = await isInTeamMailbox(client, accountId, draftId).catch(
      (error: unknown) => {
        console.warn('Draft sharing not read', error)
        // Not known: better ask than destroy
        return true
      }
    )
    if (!isShared) return 'delete'
    const choice = await choose({
      title: t('composer.template.shared.title'),
      message: t('composer.template.shared.message'),
      confirmLabel: t('composer.template.shared.delete'),
      alternativeLabel: t('composer.template.shared.keep'),
      isDestructive: true
    })
    return choice === 'confirm'
      ? 'delete'
      : choice === 'alternative'
        ? 'keep'
        : 'cancel'
  }

  /**
   * "Save as template" (tmail-flutter): the message goes to Templates (the
   * one of the team mailbox of the identity, when it has one and the rights
   * allow it), replacing the template it was opened from or last saved as.
   * It is kept there: the draft goes, the one this composer made and the
   * one it was opened on (asked first when it is shared), and closing it
   * asks nothing until it changes again.
   */
  // As tmail-flutter (`SavingTemplateDialogView`): a dialog while it saves
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const handleSaveTemplate = (): void => {
    setMoreAnchor(null)
    cancelAutosave()
    const run = savingRef.current.then(async (): Promise<void> => {
      const editor = editorRef.current
      if (!editor) return
      const previous = templateIdRef.current
      try {
        const draftFate = await askAboutDraft()
        if (draftFate === 'cancel') return
        setIsSavingTemplate(true)
        const email = await buildEmail(
          composed(editor),
          images,
          mailboxIds,
          'template'
        )
        const target = chooseTemplatesTarget(mailboxes, identityEmail)
        const targetKey = templatesTargetKey(target)
        const result = await saveTemplate(
          client,
          accountId,
          email,
          {
            ...target,
            mailboxId:
              target.mailboxId ??
              createdTemplatesRef.current.get(targetKey) ??
              null
          },
          previous,
          images
        )
        createdTemplatesRef.current.set(targetKey, result.mailboxId)
        templateIdRef.current = result.emailId
        files.rebase(result.attachments)
        savedRef.current = fingerprintOf(editor)
        setSaveState('idle')
        onChange?.()
        if (draftFate === 'delete') {
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
      } finally {
        setIsSavingTemplate(false)
      }
    })
    savingRef.current = run
  }

  const handleOpenTemplatePicker = (): void => {
    setMoreAnchor(null)
    setIsPickerOpen(true)
  }

  const handleClosePicker = (): void => {
    setIsPickerOpen(false)
    moreButtonRef.current?.focus()
  }

  /**
   * "Insert template": its subject and body (its files and recipients stay
   * out). Into an empty message, the body goes where the cursor is, above
   * the signature. Into a message with something written, the user says: at
   * the cursor (the subject is kept unless it is empty), or the whole
   * message replaced (the quote and the signature too), the one choice
   * that loses nothing by default. The signature is the identity's, not the
   * template's: the one of the template is dropped and the message keeps
   * (or gets back) the signature of its current identity, never two.
   */
  const handleInsertTemplate = async (
    template: TemplateSummary
  ): Promise<void> => {
    const editor = editorRef.current
    if (!editor) return
    setIsPickerOpen(false)
    try {
      const loaded = await loadDraftContent(
        client,
        accountId,
        template.id,
        identities,
        images,
        { isTemplate: true }
      )
      const isEmpty =
        subject.trim() === '' &&
        writtenText('', getEditorHtml(editor)).trim() === ''
      let mode: 'insert' | 'replace' = 'insert'
      if (!isEmpty) {
        const choice = await choose({
          title: t('composer.template.insertTitle'),
          message: t('composer.template.insertMessage'),
          confirmLabel: t('composer.template.insertHere'),
          alternativeLabel: t('composer.template.replace')
        })
        if (choice === 'cancel') {
          moreButtonRef.current?.focus()
          return
        }
        mode = choice === 'confirm' ? 'insert' : 'replace'
      }
      const body = removeSignatures(loaded.html)
      if (mode === 'replace') {
        editor.chain().focus().setContent(body).run()
        const current = identities.find(
          candidate => candidate.id === identityId
        )
        replaceSignature(editor, current ? signatureHtml(current) : null)
        setSubject(loaded.subject)
      } else {
        if (subject.trim() === '') setSubject(loaded.subject)
        editor.chain().focus().insertContent(body).run()
      }
      if (loaded.hasBlockedImages) setHasBlockedImages(true)
      markChanged()
      notify({ message: t('composer.template.inserted'), severity: 'success' })
    } catch (error: unknown) {
      console.error(error)
      notify({
        message: t('composer.template.insertFailed'),
        severity: 'error'
      })
    }
  }

  const handleDeleteDraft = (): void => {
    cancelAutosave()
    void savingRef.current
      .then(destroyDraft)
      .then(() => {
        notify({ message: t('composer.draft.deleted') })
        onDone('discarded')
      })
      .catch((error: unknown) => {
        console.error(error)
        notify({ message: t('common.errorOccurred'), severity: 'error' })
      })
  }

  // The sparkle under the selection opens the assistant's menu on it
  const [scribeAnchor, setScribeAnchor] = useState<HTMLElement | null>(null)
  const [isScribeOn] = useScribePreference()
  const hasScribe = isScribeOn && scribeEndpoint(session, accountId) !== null

  // The AI assistant works on the selection, else on what the user wrote
  const scribeInput = (): ScribeInput => {
    const editor = editorRef.current
    if (!editor) return { text: '', isSelection: false }
    const { from, to, empty } = editor.state.selection
    return empty
      ? { text: editorText(getEditorHtml(editor)), isSelection: false }
      : {
          text: editor.state.doc.textBetween(from, to, '\n'),
          isSelection: true
        }
  }

  const handleScribeReplace = (text: string): void => {
    editorRef.current?.chain().focus().insertContent(suggestionHtml(text)).run()
    markChanged()
  }

  const handleScribeInsert = (text: string): void => {
    const editor = editorRef.current
    if (!editor) return
    editor
      .chain()
      .focus()
      .insertContentAt(editor.state.selection.to, suggestionHtml(text))
      .run()
    markChanged()
  }

  // Twake Drive files shared by link: their cards where the caret is
  const handleDriveLinks = (picked: DriveFile[]): void => {
    editorRef.current
      ?.chain()
      .focus()
      .insertHtmlBlock({
        html: driveCardsBlock(picked, t('composer.drive.openInDrive')),
        kind: DRIVE_CARD_BLOCK,
        display: 'inline'
      })
      .run()
    markChanged()
  }

  const handlePickFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    const picked = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (picked.length > 0) files.addFiles(picked)
  }

  /**
   * The send check asked for recipients: the focus goes to the To field, not back to Send
   * (the dialog gives it back once closed, hence the wait)
   */
  const focusRecipients = (): void => {
    window.setTimeout(() => {
      fileInputRef.current
        ?.closest('[role="dialog"]')
        ?.querySelector<HTMLInputElement>('input[role="combobox"]')
        ?.focus()
    }, 50)
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
      focusRecipients()
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
      focusRecipients()
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
   * attachment; the quote and the signature are not read. A Twake Drive
   * card is a file shared: no reminder.
   */
  const checkAttachmentReminder = async (): Promise<boolean> => {
    const editor = editorRef.current
    if (!editor || files.attachments.length > 0) return true
    if (hasDriveCards(getEditorHtml(editor))) return true
    const keywords = findAttachmentKeywords(
      writtenText(subject, getEditorHtml(editor))
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
    setIsSendOverQuota(false)
    const lists = allRecipients()
    setRecipients(lists)
    setInputs(EMPTY_INPUTS)
    if (!(await checkBeforeSending(lists))) return
    setSendingStep('creating')
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
      setSendingStep('sending')
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
        if (init.unsubscribeEmailId !== undefined) {
          markUnsubscribed(init.unsubscribeEmailId, null).catch(
            (error: unknown) => {
              console.error('[composer] Cannot mark as unsubscribed', error)
            }
          )
        }
        onDone('sent')
        return
      }
      if (result.draftId !== null) {
        // Created but not sent: it is the draft now
        leftoversRef.current = result.leftovers
        setDraftId(result.draftId)
        savedRef.current = fingerprintOf(editor)
      }
      setIsSendOverQuota(result.reason === 'overQuota')
      setSendError(
        t(SEND_FAILURE_KEYS[result.reason], {
          invalidRecipients: result.invalidRecipients.join(', ')
        })
      )
    } catch (error: unknown) {
      console.error(error)
      setSendError(t(sendErrorKey(error)))
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

  const gap = isPhone ? undefined : 'u-ml-half'
  const formattingButton = (
    <ActionIconButton
      label={labels.toolbar}
      aria-pressed={isToolbarShown}
      onClick={() => {
        setIsToolbarShown(shown => !shown)
      }}
      data-testid="composer-formatting-button"
    >
      <Icon icon={FormattingIcon} size={isPhone ? 28 : 24} aria-hidden="true" />
    </ActionIconButton>
  )
  const attachButton = (
    <ActionIconButton
      label={t('composer.attachments.attach')}
      onClick={() => fileInputRef.current?.click()}
      className={gap}
      data-testid="composer-attach-file-button"
    >
      <Icon icon={Attachment} size={24} aria-hidden="true" />
    </ActionIconButton>
  )
  const imageButton = (
    <ActionIconButton
      label={labels.insertImage}
      onClick={() => editorActions.current?.pickImages()}
      className={gap}
      data-testid={EDITOR_TEST_IDS.toolbarButton?.('image')}
    >
      <Icon icon={ImageIcon} size={24} aria-hidden="true" />
    </ActionIconButton>
  )
  // On a phone the link is in the More menu, as the bar has no room for it
  const linkButton = (
    <ActionIconButton
      label={labels.link}
      onClick={() => editorActions.current?.openLinkDialog()}
      className={gap}
      data-testid={EDITOR_TEST_IDS.toolbarButton?.('link')}
    >
      <Icon icon={LinkIcon} size={24} aria-hidden="true" />
    </ActionIconButton>
  )
  const driveButton = (
    <DriveAttachButton
      maxFileSize={uploadLimits.maxFileSize}
      onLinks={handleDriveLinks}
      onAttach={files.addFiles}
    />
  )
  const scribeMenu = (
    <ScribeMenu
      externalAnchor={scribeAnchor}
      onExternalClose={() => {
        setScribeAnchor(null)
      }}
      getInput={scribeInput}
      onReplace={handleScribeReplace}
      onInsert={handleScribeInsert}
    />
  )
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      hidden
      onChange={handlePickFiles}
      data-testid="composer-file-input"
    />
  )
  const saveStatus = (
    <>
      {/* To read, not announced: see `saveAnnouncement` */}
      <Typography
        variant="caption"
        color="textPrimary"
        className={isPhone ? 'u-visuallyhidden' : 'u-flex-auto u-ph-1'}
        data-testid="composer-save-status"
      >
        {saveStateKey === null ? '' : t(saveStateKey)}
      </Typography>
      {/* Always mounted: a live region only announces changes */}
      <Box
        role="status"
        className="u-visuallyhidden"
        data-testid="composer-save-announcement"
      >
        {saveAnnouncement}
      </Box>
    </>
  )
  const moreButton = (
    <ActionIconButton
      ref={moreButtonRef}
      label={t('composer.more')}
      aria-haspopup="menu"
      aria-expanded={moreAnchor !== null}
      onClick={handleOpenMore}
      className={gap}
      data-testid="composer-more-button"
    >
      <Icon icon={Dots} size={24} aria-hidden="true" />
    </ActionIconButton>
  )
  // As tmail-flutter: "Save as draft" beside "Delete", the menu holds it
  // on a phone only
  const saveDraftButton = (
    <ActionIconButton
      label={t('composer.saveAsDraft')}
      onClick={handleSaveDraft}
      className="u-ml-half"
      data-testid="composer-save-draft-button"
    >
      <Icon icon={SaveDraftIcon} size={24} aria-hidden="true" />
    </ActionIconButton>
  )
  // As tmail-flutter on phones: the arrow up in a blue disc, grey while
  // there is no recipient (a click still says why it cannot go)
  const canSend =
    recipients.to.length + recipients.cc.length + recipients.bcc.length > 0
  const sendButton = isPhone ? (
    <ActionIconButton
      label={t('composer.send')}
      onClick={() => {
        void handleSend()
      }}
      aria-describedby={sendError === null ? undefined : sendErrorId}
      data-testid="composer-send-button"
    >
      <Icon
        icon={canSend ? SendMobileIcon : SendDisabledIcon}
        size={30}
        aria-hidden="true"
      />
    </ActionIconButton>
  ) : (
    // As tmail-flutter: the button stays as it is, the sending dialog
    // covers the window (and `handleSend` refuses a second send)
    <PillButton
      label={t('composer.send')}
      icon={Paperplane}
      width={128}
      onClick={() => {
        void handleSend()
      }}
      aria-describedby={sendError === null ? undefined : sendErrorId}
      data-testid="composer-send-button"
    />
  )
  const sendingDialog = (
    <SendingDialog
      open={isSending}
      title={t('composer.sending')}
      statusLabel={t('composer.sendingDialog.status')}
      status={t(
        sendingStep === 'creating'
          ? 'composer.sendingDialog.creating'
          : 'composer.sending'
      )}
      progressLabel={t('composer.sendingDialog.progress')}
      data-testid="composer-sending-dialog"
    />
  )
  const savingTemplateDialog = (
    <SendingDialog
      open={isSavingTemplate}
      title={t('composer.template.saving')}
      statusLabel={t('composer.sendingDialog.status')}
      status={t('composer.sendingDialog.creating')}
      progressLabel={t('composer.sendingDialog.progress')}
      data-testid="composer-saving-template-dialog"
    />
  )
  const moreMenu = (
    <Menu
      anchorEl={moreAnchor}
      open={moreAnchor !== null}
      onClose={() => {
        setMoreAnchor(null)
      }}
    >
      {isPhone ? (
        <MenuItem
          onClick={() => {
            setMoreAnchor(null)
            editorActions.current?.openLinkDialog()
          }}
          data-testid="composer-link-item"
        >
          <ListItemText inset primary={labels.link} />
        </MenuItem>
      ) : null}
      {isPhone ? (
        <MenuItem
          onClick={handleSaveDraft}
          data-testid="composer-save-draft-item"
        >
          <ListItemText inset primary={t('composer.saveAsDraft')} />
        </MenuItem>
      ) : null}
      <MenuItem
        onClick={handleOpenTemplatePicker}
        data-testid="composer-insert-template-item"
      >
        <ListItemText inset primary={t('composer.template.insert')} />
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
      {isPhone ? (
        <MenuItem
          onClick={() => {
            setMoreAnchor(null)
            handleDeleteDraft()
          }}
          data-testid="composer-delete-draft-item"
        >
          <ListItemText inset primary={t('composer.draft.delete')} />
        </MenuItem>
      ) : null}
    </Menu>
  )

  return (
    // Only the body takes dropped files, as tmail-flutter: elsewhere they
    // do nothing
    <Box
      className="u-flex u-flex-column u-flex-auto u-ov-hidden"
      onDragOver={ignoreFileDropsOutsideZones}
      onDrop={ignoreFileDropsOutsideZones}
    >
      {/* Ctrl+Enter sends, from any field of the message */}
      <div
        role="presentation"
        className="u-flex u-flex-column u-flex-auto u-ov-hidden"
        onKeyDown={handleKeyDown}
      >
        {isPhone ? (
          <TopActionBar
            data-testid="composer-top-bar"
            start={
              <ActionIconButton
                label={t('composer.window.close')}
                onClick={onRequestClose}
                data-testid="composer-close-button"
              >
                <Icon icon={Cancel} size={24} aria-hidden="true" />
              </ActionIconButton>
            }
          >
            {topBarActions}
            {scribeMenu}
            {formattingButton}
            {attachButton}
            {imageButton}
            {driveButton}
            {sendButton}
            {moreButton}
            {fileInput}
            {saveStatus}
          </TopActionBar>
        ) : null}
        <Box className="u-flex-shrink-0">
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
            onHide={kind => {
              setShown(current => {
                const next = new Set(current)
                next.delete(kind)
                return next
              })
              setRecipients(current => ({ ...current, [kind]: [] }))
              setInputs(current => ({ ...current, [kind]: '' }))
            }}
            fromLine={
              isFromShown ? (
                <FieldLine label={t('composer.fields.from')} labelId={fromId}>
                  <Select
                    variant="standard"
                    disableUnderline
                    fullWidth
                    labelId={fromId}
                    value={identityId ?? ''}
                    onChange={event => {
                      handleIdentityChange(event.target.value)
                    }}
                    SelectDisplayProps={{
                      // @ts-expect-error data attributes are valid on the display
                      'data-testid': 'composer-identity-select'
                    }}
                  >
                    {identities.map(identity => (
                      <MenuItem key={identity.id} value={identity.id}>
                        {identity.name === ''
                          ? identity.email
                          : `${identity.name} <${identity.email}>`}
                      </MenuItem>
                    ))}
                  </Select>
                </FieldLine>
              ) : null
            }
            onShowFrom={
              identities.length > 1 && !isFromShown
                ? () => {
                    setIsFromShown(true)
                  }
                : null
            }
            isCollapsed={isCollapsed}
            onExpand={() => {
              setIsCollapsed(false)
            }}
            autoFocusTo={autoFocus && !opensOnText}
          />
          <FieldLine
            label={t('composer.fields.subject')}
            htmlFor={subjectId}
            isLabelHidden
          >
            <InputBase
              id={subjectId}
              value={subject}
              placeholder={t('composer.fields.subject')}
              onChange={event => {
                setSubject(event.target.value)
              }}
              onFocus={collapseRecipients}
              fullWidth
              inputProps={{ 'data-testid': 'composer-subject-input' }}
            />
          </FieldLine>
        </Box>
        {hasBlockedImages ? (
          <Box className="u-ph-1 u-pt-half u-flex-shrink-0">
            <RemoteContentBanner
              onShow={handleShowImages}
              onAlwaysShow={null}
            />
          </Box>
        ) : null}
        {/* Focusing the body folds the recipients, as the subject does.
            Files dropped on the body are attached, as tmail-flutter (images
            dropped in the text go inline) */}
        <FileDropZone
          label={t('composer.attachments.dropHere')}
          onFiles={files.addFiles}
          isForChild={isImageDropOnBody}
          className="u-flex u-flex-column u-flex-auto u-ov-hidden"
          data-testid="composer-drop-zone"
        >
          {inlineUploads > 0 ? (
            <Box className="u-ph-1 u-flex-shrink-0">
              <ThinProgressBar
                value={null}
                height={2}
                label={t('composer.images.inserting')}
                data-testid="composer-inline-image-progress"
              />
            </Box>
          ) : null}
          <Box
            className="u-flex u-flex-column u-flex-auto u-ov-hidden"
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
              fontFamilies={fontFamilies}
              onImageFiles={handleImageFiles}
              htmlBlock={{
                buildFrameDocument: html =>
                  buildBlockDocument(
                    `<div data-html-block="quote">${resolveCidSources(
                      html,
                      cid => images.urlFor(cid)
                    )}</div>`
                  ),
                frameTitle: () => t('composer.quote.frameTitle'),
                editLabel: kind =>
                  kind === 'quote' ? t('composer.quote.edit') : null,
                editableHtml: (_kind, html) =>
                  editableQuoteHtml(html, cid => images.urlFor(cid)),
                editTestId: htmlBlockEditTestId,
                toggleLabel: kind =>
                  kind === 'signature' ? t('composer.signature') : null,
                toggleTestId: kind =>
                  kind === 'signature' ? 'composer-signature-toggle' : undefined
              }}
              selectionAction={
                hasScribe
                  ? {
                      label: t('composer.scribe.assistant'),
                      icon: (
                        <Icon icon={Sparkle} size={12} aria-hidden="true" />
                      ),
                      onSelect: setScribeAnchor,
                      testId: 'composer-scribe-selection-button'
                    }
                  : undefined
              }
              footerBlockKinds={['signature', 'quote']}
              autoFocus={autoFocus && opensOnText}
              fill
              isToolbarBelow
              isToolbarShown={isToolbarShown}
              hasInsertButtons={false}
              actions={editorActions}
              onReady={handleEditorReady}
              onUpdate={handleEditorUpdate}
              testIds={EDITOR_TEST_IDS}
            />
          </Box>
        </FileDropZone>
        <Box className="u-flex-shrink-0">
          <ComposerAttachmentsList files={files} />
          {sendError === null ? null : (
            <Typography
              id={sendErrorId}
              role="alert"
              variant="body2"
              color="textPrimary"
              className="u-ph-1 u-pv-half u-flex u-flex-items-center"
              data-testid="composer-send-error"
            >
              <Icon icon={Warning} aria-hidden="true" className="u-mr-half" />
              {sendError}
              {isSendOverQuota ? (
                <>
                  {' '}
                  <UpgradeStorageLink
                    label={t('quota.increase')}
                    data-testid="composer-upgrade-link"
                  />
                </>
              ) : null}
            </Typography>
          )}
        </Box>
        {isPhone ? null : (
          <Box className="u-flex u-flex-items-center u-flex-shrink-0 u-flex-wrap u-pv-1 u-ph-2">
            {formattingButton}
            {attachButton}
            {imageButton}
            {linkButton}
            <EmojiButton
              onInsert={emoji => {
                editorActions.current?.insertText(emoji)
              }}
              onDismiss={() => editorActions.current?.focus()}
            />
            {driveButton}
            {scribeMenu}
            {moreButton}
            {fileInput}
            {saveStatus}
            <ActionIconButton
              label={t('composer.draft.delete')}
              onClick={handleDeleteDraft}
              data-testid="composer-delete-draft-button"
            >
              <Icon icon={Trash} size={24} aria-hidden="true" />
            </ActionIconButton>
            {saveDraftButton}
            <span className="u-ml-1">{sendButton}</span>
          </Box>
        )}
        {moreMenu}
        {sendingDialog}
        {savingTemplateDialog}
        <TemplatePicker
          open={isPickerOpen}
          onClose={handleClosePicker}
          mailboxes={mailboxes}
          onPick={template => {
            void handleInsertTemplate(template)
          }}
        />
      </div>
    </Box>
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
  const draftsId = drafts?.id ?? null
  const sentId = sent?.id ?? null
  const ownMailboxIds = useMemo(
    () => (draftsId === null ? null : { drafts: draftsId, sent: sentId }),
    [draftsId, sentId]
  )
  const { session } = useJmapSession()
  const { lang } = useI18n()
  const { quote } = useEditorLabels()
  const serverSettings = useServerSettings()
  const { composerId, init } = props
  // The facade of a team mailbox writes from its address
  const teamRoot = useTeamMailboxRoot()
  const teamAddress =
    teamRoot === null
      ? null
      : (teamMailboxAddress(teamRoot)?.toLowerCase() ?? null)
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
      const kept = props.restored ?? null
      if (kept) return restoreSnapshotContent(kept, images)
      if (init.draftId !== undefined) {
        return loadDraftContent(client, accountId, init.draftId, list, images)
      }
      if (init.editAsNewEmailId !== undefined) {
        return loadDraftContent(
          client,
          accountId,
          init.editAsNewEmailId,
          list,
          images,
          { asNew: true }
        )
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
          mailboxes.data ?? [],
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
      if (init.mailto !== undefined) {
        return mailtoContent(list, init.mailto, options)
      }
      return newMessageContent(list, options, teamAddress)
    },
    // The folders tell the team mailbox an answered email is in
    enabled:
      identities.data !== undefined &&
      mailboxes.data !== undefined &&
      serverSettings.isSettled,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false
  })

  // A phone has no title bar: loading and failing keep a way out
  const isPhone = useScreenSize() === 'mobile'
  const waiting = (message: ReactElement): ReactElement => (
    <>
      {isPhone ? (
        <TopActionBar
          start={
            <ActionIconButton
              label={t('composer.window.close')}
              onClick={props.onRequestClose}
              data-testid="composer-close-button"
            >
              <Icon icon={Cross} size={16} aria-hidden="true" />
            </ActionIconButton>
          }
        >
          {props.topBarActions}
        </TopActionBar>
      ) : null}
      {message}
    </>
  )

  if (
    identities.isError ||
    mailboxes.isError ||
    content.isError ||
    (mailboxes.data && !drafts)
  ) {
    return waiting(
      <Typography role="alert" className="u-p-1">
        {t('common.errorOccurred')}
      </Typography>
    )
  }
  if (!identities.data || !ownMailboxIds || !content.data) {
    return waiting(
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
      ownMailboxIds={ownMailboxIds}
      mailboxes={mailboxes.data ?? []}
      images={images}
    />
  )
}
