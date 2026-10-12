import { Icon } from '@linagora/twake-icons'
import {
  Checkbox,
  FormControlLabel,
  TextField,
  Typography
} from '@linagora/twake-mui'
import { useQueryClient } from '@tanstack/react-query'
import type { Editor } from '@tiptap/core'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type SubmitEvent,
  type ReactElement
} from 'react'

import { ConfirmDialogButton } from '@/ds/ConfirmDialogFrame/ConfirmDialogFrame'
import { FileDropZone } from '@/ds/FileDropZone/FileDropZone'
import { CheckboxOff, CheckboxOn } from '@/ds/FlutterIcons/FlutterIcons'
import {
  FormDialogFrame,
  FormFieldRow
} from '@/ds/FormDialogFrame/FormDialogFrame'
import { IMAGE_TYPES, RichTextEditor } from '@/ds/RichTextEditor/RichTextEditor'
import type { InlineImageAttributes } from '@/ds/RichTextEditor/inlineImage'
import type { RichTextEditorActions } from '@/ds/RichTextEditor/types'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useEditorLabels } from '@common/features/composer/useEditorLabels'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import {
  allowedIdentityEmails,
  parseIdentityAddresses,
  publicAssetIdsIn,
  signatureFromEditorHtml,
  signatureToEditorHtml,
  validateIdentityName,
  formatIdentityAddresses
} from './identityForm'
import {
  createIdentity,
  updateIdentity,
  type IdentityMutationResult
} from './identityMutations'
import { identityKeys, type IdentitySummary } from './queries'
import {
  applySignatureAssetChanges,
  discardSignatureImages,
  publishSignatureImage,
  signatureAssetChanges
} from './signatureAssets'
import { shrinkSignatureImage, signatureImageMaxWidth } from './signatureImage'

export interface IdentityFormDialogProps {
  /** The identity to edit, null to create one */
  identity: IdentitySummary | null
  /** Every identity, sorted (the first is the default one) */
  identities: readonly IdentitySummary[]
  /** The server sorts identities: a default one can be chosen */
  hasSortOrder: boolean
  onClose: () => void
}

type FieldProblem = TranslationKey | null

const EDITOR_TEST_IDS = { editor: 'identity-signature-editor' }

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Unreadable image'))
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Creates or edits an identity, as tmail-flutter's identity creator: name,
 * address (among the ones the user can send from; fixed once created),
 * Reply-To and Bcc addresses, a rich signature whose images are published
 * as PublicAssets when the server can, and "Set as default identity".
 */
export function IdentityFormDialog({
  identity,
  identities,
  hasSortOrder,
  onClose
}: IdentityFormDialogProps): ReactElement {
  const { t } = useI18n()
  const client = useJmapClient()
  const queryClient = useQueryClient()
  const { accountId, session } = useJmapSession()
  const { notify } = useNotify()
  const screenSize = useScreenSize()
  const isMobile = screenSize === 'mobile'
  const { labels, colors, fontSizes, fontFamilies } = useEditorLabels()
  const titleId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const replyToRef = useRef<HTMLInputElement>(null)
  const bccRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const editorActionsRef = useRef<RichTextEditorActions>(null)
  const [initialSignature] = useState(() =>
    identity === null ? '' : signatureToEditorHtml(identity)
  )
  const [assetsBefore] = useState(() =>
    identity === null ? [] : publicAssetIdsIn(identity.htmlSignature)
  )
  const publishedRef = useRef<string[]>([])
  // Saved or cancelled: the images published meanwhile are taken care of
  const isSettledRef = useRef(false)
  const [storingCount, setStoringCount] = useState(0)
  const wasDefault = identity !== null && identities[0]?.id === identity.id
  const emails = allowedIdentityEmails(identities, session.username)
  const [name, setName] = useState(identity?.name ?? '')
  const [email, setEmail] = useState(identity?.email ?? session.username)
  const [replyTo, setReplyTo] = useState(
    formatIdentityAddresses(identity?.replyTo)
  )
  const [bcc, setBcc] = useState(formatIdentityAddresses(identity?.bcc))
  const [isDefault, setIsDefault] = useState(wasDefault)
  const [isTouched, setIsTouched] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<TranslationKey | null>(null)

  const canPublishImages = client.hasCapability(
    LINAGORA_CAPABILITIES.publicAssets
  )
  const maxUploadSize = (
    session.capabilities['urn:ietf:params:jmap:core'] as
      { maxSizeUpload?: number } | undefined
  )?.maxSizeUpload

  // Left another way (the browser back, a link): as tmail-flutter, the
  // images published for nothing are destroyed
  useEffect(() => {
    const published = publishedRef.current
    return () => {
      if (isSettledRef.current) return
      discardSignatureImages(client, accountId, published).catch(
        (error: unknown) => {
          console.warn('[identities] Images left unused on the server', error)
        }
      )
    }
  }, [client, accountId])

  const nameProblem: FieldProblem = validateIdentityName(name)
  const replyToResult = parseIdentityAddresses(replyTo)
  const bccResult = parseIdentityAddresses(bcc)
  const replyToProblem: FieldProblem = replyToResult.ok
    ? null
    : 'identities.errors.invalidAddress'
  const bccProblem: FieldProblem = bccResult.ok
    ? null
    : 'identities.errors.invalidAddress'
  const shown = (problem: FieldProblem): FieldProblem =>
    isTouched ? problem : null

  const storeImage = async (
    original: File
  ): Promise<InlineImageAttributes | null> => {
    const file = await shrinkSignatureImage(
      original,
      maxUploadSize ?? Number.POSITIVE_INFINITY,
      signatureImageMaxWidth(window.innerWidth, screenSize === 'desktop')
    )
    if (file === null) {
      notify({
        message: t('identities.errors.imageCompress'),
        severity: 'error'
      })
      return null
    }
    if (maxUploadSize !== undefined && file.size > maxUploadSize) {
      notify({
        message: t('identities.errors.imageTooLarge', {
          maxSize: Math.floor(maxUploadSize / 1024)
        }),
        severity: 'error'
      })
      return null
    }
    if (!canPublishImages) {
      // Without PublicAssets, the image travels inside the signature
      return {
        src: await readAsDataUrl(file),
        alt: original.name,
        reference: null,
        width: null
      }
    }
    const published = await publishSignatureImage(
      client,
      accountId,
      file,
      identity?.id ?? null
    )
    if (!published.ok) {
      const { type, description } = published.error
      // The server says how much room the images may take
      notify({
        message:
          type === 'overQuota' && description
            ? description
            : t('identities.errors.imageUpload'),
        severity: 'error'
      })
      return null
    }
    publishedRef.current.push(published.value.assetId)
    return {
      src: published.value.publicUri,
      alt: original.name,
      reference: published.value.assetId,
      width: null
    }
  }

  const handleImageFiles = async (
    files: File[]
  ): Promise<InlineImageAttributes[]> => {
    const accepted = files.filter(file => IMAGE_TYPES.includes(file.type))
    if (accepted.length === 0) {
      notify({ message: t('identities.errors.notAnImage'), severity: 'error' })
      return []
    }
    setStoringCount(count => count + 1)
    const images: InlineImageAttributes[] = []
    try {
      for (const file of accepted) {
        const image = await storeImage(file).catch((error: unknown) => {
          console.error('[identities] Cannot add the image', error)
          notify({
            message: t('identities.errors.imageUpload'),
            severity: 'error'
          })
          return null
        })
        if (image) images.push(image)
      }
    } finally {
      setStoringCount(count => count - 1)
    }
    return images
  }

  const handleCancel = (): void => {
    if (isSaving) return
    isSettledRef.current = true
    discardSignatureImages(client, accountId, publishedRef.current).catch(
      (error: unknown) => {
        console.warn('[identities] Images left unused on the server', error)
      }
    )
    onClose()
  }

  const readSignature = (): { html: string; text: string } => {
    const editor = editorRef.current
    if (!editor || editor.isEmpty) return { html: '', text: '' }
    return {
      html: signatureFromEditorHtml(editor.getHTML()),
      text: editor.getText({ blockSeparator: '\n' }).trim()
    }
  }

  const save = async (): Promise<IdentityMutationResult> => {
    const signature = readSignature()
    const values = {
      name,
      replyTo: replyToResult.ok ? replyToResult.value : [],
      bcc: bccResult.ok ? bccResult.value : [],
      htmlSignature: signature.html,
      textSignature: signature.text
    }
    const result =
      identity === null
        ? await createIdentity(client, accountId, {
            values: { ...values, email },
            makeDefault: isDefault,
            hasSortOrder,
            identities
          })
        : await updateIdentity(client, accountId, {
            id: identity.id,
            values,
            isDefault: isDefault === wasDefault ? null : isDefault,
            hasSortOrder,
            identities
          })
    if (result.ok && canPublishImages) {
      const changes = signatureAssetChanges({
        before: assetsBefore,
        published: publishedRef.current,
        saved: publicAssetIdsIn(signature.html),
        isNewIdentity: identity === null
      })
      await applySignatureAssetChanges(
        client,
        accountId,
        result.id,
        changes
      ).catch((error: unknown) => {
        console.warn('[identities] Signature images not updated', error)
      })
    }
    return result
  }

  const handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault()
    setIsTouched(true)
    if (nameProblem !== null) {
      nameRef.current?.focus()
      return
    }
    if (replyToProblem !== null) {
      replyToRef.current?.focus()
      return
    }
    if (bccProblem !== null) {
      bccRef.current?.focus()
      return
    }
    setIsSaving(true)
    setSaveError(null)
    save()
      .then(async result => {
        if (!result.ok) {
          setSaveError(
            result.error?.type === 'forbiddenFrom'
              ? 'identities.errors.forbiddenFrom'
              : 'identities.errors.save'
          )
          setIsSaving(false)
          return
        }
        isSettledRef.current = true
        await queryClient.invalidateQueries({
          queryKey: identityKeys.all(accountId)
        })
        notify({
          message: t(
            identity !== null
              ? 'identities.toasts.updated'
              : isDefault
                ? 'identities.toasts.createdDefault'
                : 'identities.toasts.created'
          ),
          severity: 'success'
        })
        onClose()
      })
      .catch((error: unknown) => {
        console.error('[identities] Cannot save the identity', error)
        setSaveError('identities.errors.save')
        setIsSaving(false)
      })
  }

  // As tmail-flutter: no room kept under a field without error
  const fieldError = (problem: FieldProblem): string | null =>
    problem === null ? null : t(problem)

  const fieldIds = {
    name: `${titleId}-name`,
    email: `${titleId}-email`,
    replyTo: `${titleId}-reply-to`,
    bcc: `${titleId}-bcc`,
    signature: `${titleId}-signature`
  }

  return (
    <FormDialogFrame
      title={t(identity === null ? 'identities.create' : 'identities.edit')}
      titleId={titleId}
      closeLabel={t(isMobile ? 'common.back' : 'common.close')}
      onClose={handleCancel}
      onSubmit={handleSubmit}
      isFullScreen={isMobile}
      footerStart={
        hasSortOrder ? (
          <FormControlLabel
            control={
              <Checkbox
                checked={isDefault}
                onChange={event => {
                  setIsDefault(event.target.checked)
                }}
                // tmail-flutter's own boxes
                icon={<Icon icon={CheckboxOff} size={20} />}
                checkedIcon={<Icon icon={CheckboxOn} size={20} />}
              />
            }
            label={t('identities.form.setDefault')}
            data-testid="identity-default-checkbox"
          />
        ) : null
      }
      actions={
        <>
          <ConfirmDialogButton
            onClick={handleCancel}
            disabled={isSaving}
            data-testid="identity-cancel-button"
          >
            {t('common.cancel')}
          </ConfirmDialogButton>
          <ConfirmDialogButton
            type="submit"
            isMain
            minWidth={110}
            disabled={isSaving}
            data-testid="save-identity-button"
          >
            {t(
              identity === null
                ? 'identities.form.create'
                : 'identities.form.save'
            )}
          </ConfirmDialogButton>
        </>
      }
      data-testid="identity-form-dialog"
    >
      <FormFieldRow
        label={t('identities.form.nameRequired')}
        htmlFor={fieldIds.name}
        isStacked={isMobile}
      >
        <TextField
          id={fieldIds.name}
          inputRef={nameRef}
          autoFocus
          required
          fullWidth
          placeholder={t('identities.form.namePlaceholder')}
          value={name}
          onChange={event => {
            setName(event.target.value)
          }}
          error={shown(nameProblem) !== null}
          helperText={fieldError(shown(nameProblem))}
          slotProps={{
            htmlInput: { 'data-testid': 'identity-name-input' }
          }}
        />
      </FormFieldRow>
      <FormFieldRow
        label={t('identities.form.emailLabel')}
        htmlFor={fieldIds.email}
        isStacked={isMobile}
      >
        <TextField
          id={fieldIds.email}
          select
          fullWidth
          value={email}
          disabled={identity !== null}
          onChange={event => {
            setEmail(event.target.value)
          }}
          slotProps={{
            select: { native: true },
            htmlInput: { 'data-testid': 'identity-email-select' }
          }}
        >
          {emails.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </TextField>
      </FormFieldRow>
      <FormFieldRow
        label={t('identities.form.replyTo')}
        htmlFor={fieldIds.replyTo}
        isStacked={isMobile}
      >
        <TextField
          id={fieldIds.replyTo}
          inputRef={replyToRef}
          fullWidth
          placeholder={t('identities.form.addressPlaceholder')}
          value={replyTo}
          onChange={event => {
            setReplyTo(event.target.value)
          }}
          error={shown(replyToProblem) !== null}
          helperText={fieldError(shown(replyToProblem))}
          slotProps={{
            htmlInput: {
              inputMode: 'email',
              'aria-description': t('identities.form.addressesHelp'),
              'data-testid': 'identity-reply-to-input'
            }
          }}
        />
      </FormFieldRow>
      <FormFieldRow
        label={t('identities.form.bcc')}
        htmlFor={fieldIds.bcc}
        isStacked={isMobile}
      >
        <TextField
          id={fieldIds.bcc}
          inputRef={bccRef}
          fullWidth
          placeholder={t('identities.form.addressPlaceholder')}
          value={bcc}
          onChange={event => {
            setBcc(event.target.value)
          }}
          error={shown(bccProblem) !== null}
          helperText={fieldError(shown(bccProblem))}
          slotProps={{
            htmlInput: {
              inputMode: 'email',
              'aria-description': t('identities.form.addressesHelp'),
              'data-testid': 'identity-bcc-input'
            }
          }}
        />
      </FormFieldRow>
      <FormFieldRow
        label={t('identities.form.signature')}
        labelId={fieldIds.signature}
        isStacked={isMobile}
      >
        {/* As tmail-flutter, files dropped anywhere on the editor */}
        <FileDropZone
          label={t('composer.attachments.dropHere')}
          onFiles={files => {
            editorActionsRef.current?.insertImages(files)
          }}
          isFlush
          data-testid="identity-signature-drop-zone"
        >
          <RichTextEditor
            labels={{ ...labels, editor: t('identities.form.signature') }}
            content={initialSignature}
            colors={colors}
            fontSizes={fontSizes}
            fontFamilies={fontFamilies}
            onImageFiles={handleImageFiles}
            shouldStorePastedDataImages={canPublishImages}
            busyLabel={storingCount > 0 ? t('composer.images.inserting') : null}
            actions={editorActionsRef}
            onReady={editor => {
              editorRef.current = editor
            }}
            testIds={EDITOR_TEST_IDS}
            look="boxed"
          />
        </FileDropZone>
      </FormFieldRow>
      {saveError === null ? null : (
        <Typography
          role="alert"
          color="error"
          variant="body2"
          className="u-mt-1"
          data-testid="identity-form-error"
        >
          {t(saveError)}
        </Typography>
      )}
    </FormDialogFrame>
  )
}
