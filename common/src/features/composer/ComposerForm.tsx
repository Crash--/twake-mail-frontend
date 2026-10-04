import { Dots, Icon } from '@linagora/twake-icons'
import {
  Box,
  IconButton,
  InputBase,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import type { Editor } from '@tiptap/core'
import { JmapSetError } from 'jmap-client-ts'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement
} from 'react'

import { RichTextEditor } from '@/ds/RichTextEditor/RichTextEditor'
import type { InlineImageAttributes } from '@/ds/RichTextEditor/inlineImage'
import { useChoose } from '@common/features/confirm/ConfirmProvider'
import { buildEmailDocument } from '@common/features/email/emailBody'
import { useIdentities } from '@common/features/identities/useIdentities'
import type { IdentitySummary } from '@common/features/identities/queries'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { buildEmail, saveDraft, type ComposedMessage } from './composeEmail'
import { EDITOR_TEST_IDS, htmlBlockEditTestId } from './editorTestIds'
import { resolveCidSources } from './emailHtml'
import { InlineImageStore } from './InlineImageStore'
import {
  RecipientsEditor,
  type RecipientKind,
  type RecipientLists
} from './RecipientsEditor'
import { mergeRecipients, parseRecipients, type Recipient } from './recipients'
import { replaceSignature, signatureBlock, signatureHtml } from './signature'
import { useEditorLabels } from './useEditorLabels'

/** What the composer window asks its form */
export interface ComposerFormHandle {
  /**
   * Before the window closes: asks to save a modified message. Resolves
   * false when the window must stay open (the user cancelled, the save
   * failed).
   */
  requestClose: () => Promise<boolean>
}

export interface ComposerFormProps {
  /** Takes the focus once loaded */
  autoFocus: boolean
  onTitleChange: (title: string) => void
  /** Gives the window what it asks the form */
  onReady: (handle: ComposerFormHandle) => void
}

const EMPTY_LISTS: RecipientLists = { to: [], cc: [], bcc: [], replyTo: [] }
const EMPTY_INPUTS: Record<RecipientKind, string> = {
  to: '',
  cc: '',
  bcc: '',
  replyTo: ''
}

function toAddresses(
  recipients: readonly Recipient[]
): { name: string | null; email: string }[] {
  return recipients.map(({ name, email }) => ({ name, email }))
}

/** The quote and the signature keep their HTML: shown in a frame */
function buildBlockDocument(content: string): string {
  return buildEmailDocument(content, { allowRemoteContent: true })
}

/** What makes a message modified, compared at closing time */
function fingerprint(
  identityId: string | null,
  recipients: RecipientLists,
  subject: string,
  html: string
): string {
  return JSON.stringify([identityId, recipients, subject, html])
}

/** The translation key of a failed draft save */
function saveErrorKey(
  error: unknown
):
  | 'composer.draft.tooLarge'
  | 'composer.draft.overQuota'
  | 'composer.draft.saveFailed' {
  if (error instanceof JmapSetError) {
    const types = Object.values(error.notCreated).map(setError => setError.type)
    if (types.includes('tooLarge')) return 'composer.draft.tooLarge'
    if (types.includes('overQuota')) return 'composer.draft.overQuota'
  }
  return 'composer.draft.saveFailed'
}

interface LoadedFormProps extends ComposerFormProps {
  identities: IdentitySummary[]
  draftsId: string
  sentId: string | null
}

function LoadedComposerForm({
  autoFocus,
  onTitleChange,
  onReady,
  identities,
  draftsId,
  sentId
}: LoadedFormProps): ReactElement {
  const { t } = useI18n()
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const { notify } = useNotify()
  const choose = useChoose()
  const { labels, colors, fontSizes } = useEditorLabels()
  const subjectId = useId()
  const [images] = useState(() => new InlineImageStore(client, accountId))
  const [identityId, setIdentityId] = useState<string | null>(
    identities[0]?.id ?? null
  )
  const [recipients, setRecipients] = useState<RecipientLists>(EMPTY_LISTS)
  const [inputs, setInputs] = useState(EMPTY_INPUTS)
  const [shown, setShown] = useState<ReadonlySet<RecipientKind>>(new Set())
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [subject, setSubject] = useState('')
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const draftIdRef = useRef<string | null>(null)
  /** The message as last saved (or opened): what "modified" compares to */
  const savedRef = useRef<string | null>(null)
  const [initialHtml] = useState(() => {
    const identity = identities[0]
    const signature = identity ? signatureHtml(identity) : null
    return `<p></p>${signature === null ? '' : signatureBlock(signature)}`
  })

  useEffect(() => () => images.dispose(), [images])

  /** Recipients, with what is still typed in the fields */
  const allRecipients = (): RecipientLists => {
    const lists = { ...recipients }
    for (const kind of Object.keys(inputs) as RecipientKind[]) {
      lists[kind] = mergeRecipients(lists[kind], parseRecipients(inputs[kind]))
    }
    return lists
  }

  const currentFingerprint = (): string | null => {
    const editor = editorRef.current
    if (!editor) return null
    return fingerprint(identityId, allRecipients(), subject, editor.getHTML())
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
      references: null
    }
  }

  const save = async (): Promise<boolean> => {
    const editor = editorRef.current
    if (!editor) return false
    const snapshot = currentFingerprint()
    try {
      const email = await buildEmail(composed(editor), images, {
        drafts: draftsId,
        sent: sentId
      })
      const result = await saveDraft(
        client,
        accountId,
        email,
        draftIdRef.current,
        images
      )
      draftIdRef.current = result.emailId
      savedRef.current = snapshot
      notify({
        message: t('composer.draft.saved'),
        severity: 'success'
      })
      return true
    } catch (error: unknown) {
      console.error(error)
      notify({ message: t(saveErrorKey(error)), severity: 'error' })
      return false
    }
  }

  const requestClose = async (): Promise<boolean> => {
    const current = currentFingerprint()
    if (current === null || current === savedRef.current) return true
    const choice = await choose({
      title: t('composer.close.title'),
      message: t('composer.close.message'),
      confirmLabel: t('composer.close.save'),
      alternativeLabel: t('composer.close.discard')
    })
    if (choice === 'cancel') return false
    if (choice === 'alternative') return true
    return save()
  }

  // The window reads the latest closures: they change with every field
  useEffect(() => {
    onReady({ requestClose })
  })

  useEffect(() => {
    onTitleChange(subject)
  }, [subject, onTitleChange])

  const handleEditorReady = (editor: Editor): void => {
    editorRef.current = editor
    savedRef.current = fingerprint(
      identityId,
      EMPTY_LISTS,
      '',
      editor.getHTML()
    )
  }

  const handleIdentityChange = (id: string): void => {
    setIdentityId(id)
    const next = identities.find(candidate => candidate.id === id)
    if (editorRef.current && next) {
      replaceSignature(editorRef.current, signatureHtml(next))
    }
  }

  const handleImageFiles = async (
    files: File[]
  ): Promise<InlineImageAttributes[]> => {
    const added = await Promise.all(files.map(file => images.add(file)))
    return added.map(image => ({
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
    void save()
  }

  return (
    <Box className="u-flex u-flex-column u-flex-auto u-ov-hidden">
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
          content={initialHtml}
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
          testIds={EDITOR_TEST_IDS}
        />
      </Box>
      <Box className="u-flex u-flex-items-center u-flex-justify-end u-ph-1 u-pv-half u-flex-shrink-0">
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
    </Box>
  )
}

/**
 * The content of a composer window: identity, recipients, subject, body,
 * and its actions. Loaded on demand with the editor (TipTap).
 */
export function ComposerForm(props: ComposerFormProps): ReactElement {
  const { t } = useI18n()
  const identities = useIdentities()
  const mailboxes = useMailboxes()
  const drafts = mailboxes.data?.find(mailbox => mailbox.role === 'drafts')
  const sent = mailboxes.data?.find(mailbox => mailbox.role === 'sent')

  if (identities.isError || mailboxes.isError || (mailboxes.data && !drafts)) {
    return (
      <Typography role="alert" className="u-p-1">
        {t('common.errorOccurred')}
      </Typography>
    )
  }
  if (!identities.data || !drafts) {
    return (
      <Typography role="status" className="u-p-1">
        {t('common.loading')}
      </Typography>
    )
  }
  return (
    <LoadedComposerForm
      {...props}
      identities={identities.data}
      draftsId={drafts.id}
      sentId={sent?.id ?? null}
    />
  )
}
