import { Attachment, Dots, Icon, Trash, Warning } from '@linagora/twake-icons'
import {
  Box,
  Button,
  IconButton,
  InputBase,
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
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement
} from 'react'

import { FileDropZone } from '@/ds/FileDropZone/FileDropZone'
import { RichTextEditor } from '@/ds/RichTextEditor/RichTextEditor'
import type { InlineImageAttributes } from '@/ds/RichTextEditor/inlineImage'
import { UploadList } from '@/ds/UploadList/UploadList'
import {
  useAlert,
  useChoose,
  useConfirm
} from '@common/features/confirm/ConfirmProvider'
import { buildEmailDocument } from '@common/features/email/emailBody'
import { formatSize } from '@common/features/email/formatSize'
import type { IdentitySummary } from '@common/features/identities/queries'
import { useIdentities } from '@common/features/identities/useIdentities'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import {
  buildEmail,
  destroyPreviousVersions,
  saveDraft,
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
  type ComposerAttachment,
  type ComposerContent,
  type ComposerSnapshot
} from './composerContent'
import { snapshotKey } from './composerStorage'
import { EDITOR_TEST_IDS, htmlBlockEditTestId } from './editorTestIds'
import { resolveCidSources, toStorageHtml } from './emailHtml'
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
import { replaceSignature, signatureHtml } from './signature'
import { useComposerAttachments } from './useComposerAttachments'
import { useEditorLabels } from './useEditorLabels'

/** Pause in the changes before a draft is saved */
export const AUTOSAVE_DELAY_MS = 1500

/** What a composer opens: a new message, or a draft of the server */
export interface ComposerInit {
  draftId?: string
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

/** The quote and the signature keep their HTML: shown in a frame */
function buildBlockDocument(content: string): string {
  return buildEmailDocument(content, { allowRemoteContent: true })
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
  images
}: LoadedFormProps): ReactElement {
  const { t, lang } = useI18n()
  const client = useJmapClient()
  const { accountId } = useJmapSession()
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
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [subject, setSubject] = useState(content.subject)
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  /** Counts the changes: each one (re)schedules an autosave */
  const [changes, setChanges] = useState(0)
  const editorRef = useRef<Editor | null>(null)
  const draftIdRef = useRef<string | null>(content.draftId)
  /** Previous versions a save failed to destroy: the next one tries again */
  const leftoversRef = useRef<string[]>(content.leftovers)
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
      files.attachments
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
      inReplyTo: null,
      references: null,
      attachments: uploadedFiles(files.attachments)
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
  }, [identityId, recipients, subject])

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
      savedFingerprint: savedRef.current
    }
  }

  // The window reads the latest closures: they change with every field
  useEffect(() => {
    onReady({ requestClose, snapshot })
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

  const handleIdentityChange = (id: string): void => {
    setIdentityId(id)
    const next = identities.find(candidate => candidate.id === id)
    if (editorRef.current && next) {
      replaceSignature(editorRef.current, signatureHtml(next))
    }
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
    if (subject.trim() === '') {
      return confirm({
        title: t('composer.sendChecks.emptySubjectTitle'),
        message: t('composer.sendChecks.emptySubject'),
        confirmLabel: t('composer.sendChecks.sendAnyway')
      })
    }
    return true
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
      const email = await buildEmail(composed(editor), images, mailboxIds)
      const result = await sendEmail(
        client,
        accountId,
        identity.id,
        email,
        mailboxIds,
        draftVersions()
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
            autoFocusTo={autoFocus}
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
              editTestId: htmlBlockEditTestId
            }}
            footerBlockKinds={['signature', 'quote']}
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
              {t('composer.saveAsDraft')}
            </MenuItem>
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
  const { composerId, init } = props
  // Read once per composer: the key only says which one
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const content = useQuery({
    queryKey: ['composer', accountId, composerId, 'content'],
    queryFn: async (): Promise<ComposerContent> => {
      const list = identities.data ?? []
      const kept = readSnapshot(snapshotKey(accountId, composerId))
      if (kept) return restoreSnapshotContent(kept, images)
      if (init.draftId !== undefined) {
        return loadDraftContent(client, accountId, init.draftId, list, images)
      }
      return newMessageContent(list)
    },
    enabled: identities.data !== undefined,
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
      images={images}
    />
  )
}
