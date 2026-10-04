import {
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@linagora/twake-mui'
import { useQuery } from '@tanstack/react-query'
import { JmapSetError } from 'jmap-client-ts'
import type { Editor } from '@tiptap/core'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useSearchParams } from 'react-router'

import { RichTextEditor } from '@/ds/RichTextEditor/RichTextEditor'
import type { InlineImageAttributes } from '@/ds/RichTextEditor/inlineImage'
import {
  buildEmail,
  saveDraft,
  sendEmail
} from '@common/features/composer/composeEmail'
import {
  loadComposerSetup,
  type ComposerSetup,
  type QuoteApproach
} from '@common/features/composer/composerSetup'
import {
  htmlToText,
  resolveCidSources,
  toEmailHtml
} from '@common/features/composer/emailHtml'
import { InlineImageStore } from '@common/features/composer/InlineImageStore'
import { sanitizeQuotedHtml } from '@common/features/composer/quote'
import { schemaQuoteExtensions } from '@common/features/composer/schemaQuoteExtensions'
import {
  replaceSignature,
  signatureHtml
} from '@common/features/composer/signature'
import {
  removeSnapshot,
  snapshotKey,
  toStorageHtml,
  writeSnapshot
} from '@common/features/composer/snapshot'
import {
  EDITOR_TEST_IDS,
  htmlBlockEditTestId
} from '@common/features/composer/editorTestIds'
import { useEditorLabels } from '@common/features/composer/useEditorLabels'
import { buildEmailDocument } from '@common/features/email/emailBody'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

const AUTOSAVE_DELAY_MS = 1500

/** The quote keeps the remote images of the quoted email */
function buildQuoteDocument(content: string): string {
  return buildEmailDocument(content, { allowRemoteContent: true })
}

interface DraftStats {
  saves: number
  lastBytes: number
  totalBytes: number
  draftId: string | null
}

function parseAddresses(value: string): { name: null; email: string }[] {
  return value
    .split(/[,;\s]+/)
    .map(email => email.trim())
    .filter(email => email.includes('@'))
    .map(email => ({ name: null, email }))
}

interface SpikeComposerFormProps {
  setup: ComposerSetup
  images: InlineImageStore
  approach: QuoteApproach
  storageKey: string
}

function SpikeComposerForm({
  setup,
  images,
  approach,
  storageKey
}: SpikeComposerFormProps): ReactElement {
  const { t } = useI18n()
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const { labels, colors, fontSizes } = useEditorLabels()
  const [identityId, setIdentityId] = useState(setup.identityId ?? '')
  const [to, setTo] = useState(setup.to)
  const [subject, setSubject] = useState(setup.subject)
  const [status, setStatus] = useState(
    setup.restored ? t('composer.spike.restored') : ''
  )
  const [stats, setStats] = useState<DraftStats>({
    saves: 0,
    lastBytes: 0,
    totalBytes: 0,
    draftId: setup.draftId
  })
  const [preview, setPreview] = useState<{ html: string; text: string } | null>(
    null
  )
  const editorRef = useRef<Editor | null>(null)
  const draftIdRef = useRef<string | null>(setup.draftId)
  const timerRef = useRef<number | null>(null)
  const savingRef = useRef<Promise<void>>(Promise.resolve())
  const fieldsRef = useRef({ identityId, to, subject })

  useEffect(() => {
    fieldsRef.current = { identityId, to, subject }
  })

  const identity = setup.identities.find(
    candidate => candidate.id === identityId
  )

  const composed = (editor: Editor): Parameters<typeof buildEmail>[0] => {
    const fields = fieldsRef.current
    const from = setup.identities.find(item => item.id === fields.identityId)
    return {
      from: { name: from?.name ?? null, email: from?.email ?? '' },
      to: parseAddresses(fields.to),
      subject: fields.subject,
      editorHtml: editor.getHTML(),
      inReplyTo: setup.inReplyTo,
      references: setup.references
    }
  }

  const saveNow = (): Promise<void> => {
    const editor = editorRef.current
    if (!editor) return Promise.resolve()
    // One save at a time: each one destroys the previous draft
    savingRef.current = savingRef.current.then(async () => {
      const email = await buildEmail(composed(editor), images, setup.mailboxIds)
      const result = await saveDraft(
        client,
        accountId,
        email,
        draftIdRef.current,
        images
      )
      draftIdRef.current = result.emailId
      setStats(previous => ({
        saves: previous.saves + 1,
        lastBytes: result.requestBytes,
        totalBytes: previous.totalBytes + result.requestBytes,
        draftId: result.emailId
      }))
      setStatus(t('composer.draftSaved'))
    })
    return savingRef.current.catch((error: unknown) => {
      console.error(
        `${String(error)} ${error instanceof JmapSetError ? JSON.stringify(error.notCreated) : ''}`
      )
    })
  }

  const scheduleSave = (): void => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void saveNow()
    }, AUTOSAVE_DELAY_MS)
  }

  useEffect(() => {
    const handleBeforeUnload = (): void => {
      const editor = editorRef.current
      if (!editor) return
      const fields = fieldsRef.current
      writeSnapshot(storageKey, {
        identityId: fields.identityId,
        to: fields.to,
        subject: fields.subject,
        html: toStorageHtml(editor.getHTML()),
        images: images.toJSON(),
        draftId: draftIdRef.current,
        inReplyTo: setup.inReplyTo,
        references: setup.references
      })
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [images, setup, storageKey])

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

  const handleIdentityChange = (id: string): void => {
    setIdentityId(id)
    const next = setup.identities.find(candidate => candidate.id === id)
    if (editorRef.current && next) {
      replaceSignature(editorRef.current, signatureHtml(next))
    }
  }

  const handleSend = async (): Promise<void> => {
    const editor = editorRef.current
    if (!editor || !identity) return
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    await savingRef.current.catch(() => undefined)
    try {
      const email = await buildEmail(composed(editor), images, setup.mailboxIds)
      await sendEmail(
        client,
        accountId,
        identity.id,
        email,
        setup.mailboxIds,
        draftIdRef.current
      )
      removeSnapshot(storageKey)
      setPreview({
        html: email.bodyValues?.html?.value ?? '',
        text: email.bodyValues?.text?.value ?? ''
      })
      setStatus(t('composer.spike.sent'))
    } catch (error: unknown) {
      console.error(error)
      setStatus(t('composer.spike.sendFailed'))
    }
  }

  const showPreview = (): void => {
    const editor = editorRef.current
    if (!editor) return
    const html = toEmailHtml(editor.getHTML())
    setPreview({ html, text: htmlToText(html) })
  }

  const handleReady = (editor: Editor): void => {
    editorRef.current = editor
    // For the spike specs (perf, HTML): the route only exists with DEBUG
    Object.assign(window, {
      spikeEditor: editor,
      spikeTools: {
        toEmailHtml,
        htmlToText,
        sanitizeQuotedHtml,
        buildEmailDocument: buildQuoteDocument,
        resolveCidSources,
        urlFor: (cid: string) => images.urlFor(cid)
      }
    })
  }

  return (
    <Stack spacing={2}>
      <TextField
        select
        label={t('composer.spike.from')}
        value={identityId}
        onChange={event => handleIdentityChange(event.target.value)}
        size="small"
        slotProps={{ htmlInput: { 'data-testid': 'spike-from-select' } }}
      >
        {setup.identities.map(item => (
          <MenuItem key={item.id} value={item.id}>
            {item.name ? `${item.name} <${item.email}>` : item.email}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label={t('composer.spike.to')}
        value={to}
        onChange={event => setTo(event.target.value)}
        size="small"
        slotProps={{ htmlInput: { 'data-testid': 'composer-to-input' } }}
      />
      <TextField
        label={t('composer.spike.subject')}
        value={subject}
        onChange={event => {
          setSubject(event.target.value)
          scheduleSave()
        }}
        size="small"
        slotProps={{ htmlInput: { 'data-testid': 'composer-subject-input' } }}
      />
      <RichTextEditor
        labels={labels}
        content={setup.html}
        colors={colors}
        fontSizes={fontSizes}
        onImageFiles={handleImageFiles}
        htmlBlock={{
          buildFrameDocument: html =>
            buildQuoteDocument(
              `<div data-html-block="quote">${resolveCidSources(html, cid =>
                images.urlFor(cid)
              )}</div>`
            ),
          frameTitle: () => t('composer.quote.frameTitle'),
          editLabel: kind =>
            kind === 'quote' ? t('composer.quote.edit') : null,
          editTestId: htmlBlockEditTestId
        }}
        extensions={approach === 'schema' ? schemaQuoteExtensions() : []}
        autoFocus
        onReady={handleReady}
        onUpdate={scheduleSave}
        testIds={EDITOR_TEST_IDS}
      />
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          onClick={() => void handleSend()}
          data-testid="composer-send-button"
        >
          {t('composer.send')}
        </Button>
        <Button
          onClick={() => void saveNow()}
          data-testid="composer-save-draft-button"
        >
          {t('composer.saveAsDraft')}
        </Button>
        <Button onClick={showPreview} data-testid="spike-preview-button">
          {t('composer.spike.html')}
        </Button>
      </Stack>
      <Typography
        role="status"
        variant="body2"
        data-testid="spike-status"
        data-saves={stats.saves}
        data-last-bytes={stats.lastBytes}
        data-total-bytes={stats.totalBytes}
        data-draft-id={stats.draftId ?? ''}
      >
        {status}
      </Typography>
      {preview ? (
        <Stack spacing={1}>
          <Typography variant="h6" component="h2">
            {t('composer.spike.html')}
          </Typography>
          <Paper variant="outlined" className="u-p-1 u-ov-auto">
            <pre data-testid="spike-outgoing-html">{preview.html}</pre>
          </Paper>
          <Typography variant="h6" component="h2">
            {t('composer.spike.text')}
          </Typography>
          <Paper variant="outlined" className="u-p-1 u-ov-auto">
            <pre data-testid="spike-outgoing-text">{preview.text}</pre>
          </Paper>
        </Stack>
      ) : null}
    </Stack>
  )
}

/**
 * `/spike/composer` (DEBUG only): the composer spike, sending for real.
 *
 *   ?reply=<emailId>&mode=reply|forward&quote=atom|schema   reply or forward
 *   ?draft=<emailId>                                       reopen a draft
 */
export function SpikeComposerPage(): ReactElement {
  const { t, lang } = useI18n()
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const { quote: quoteLabels } = useEditorLabels()
  const [params] = useSearchParams()
  const [images] = useState(() => new InlineImageStore(client, accountId))
  const approach: QuoteApproach =
    params.get('quote') === 'schema' ? 'schema' : 'atom'
  // One composer per URL: a reload restores the composer of that URL
  const storageKey = snapshotKey(accountId, `spike?${params.toString()}`)
  const composerParams = {
    sourceId: params.get('reply'),
    mode:
      params.get('mode') === 'forward'
        ? ('forward' as const)
        : ('reply' as const),
    approach,
    draftId: params.get('draft'),
    snapshotKey: storageKey
  }
  // The setup is read once per page: the key only says which message
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const query = useQuery({
    queryKey: ['composer', accountId, 'spike', params.toString()],
    queryFn: () =>
      loadComposerSetup(
        client,
        accountId,
        composerParams,
        images,
        quoteLabels,
        lang
      ),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false
  })

  useEffect(() => {
    document.title = `${t('composer.spike.title')} - Twake Mail`
  }, [t])
  useEffect(() => () => images.dispose(), [images])

  return (
    <div className="u-p-2 u-ov-auto u-h-100">
      <Typography variant="h5" component="h1" className="u-mb-1">
        {t('composer.spike.title')}
      </Typography>
      {query.data ? (
        <SpikeComposerForm
          setup={query.data}
          images={images}
          approach={approach}
          storageKey={storageKey}
        />
      ) : query.isError ? (
        <Typography role="alert" data-testid="spike-error">
          {t('common.errorOccurred')} {String(query.error)}
        </Typography>
      ) : (
        <Typography role="status">{t('common.loading')}</Typography>
      )}
    </div>
  )
}
