import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField
} from '@linagora/twake-mui'
import { useQueryClient } from '@tanstack/react-query'
import type { Label } from 'jmap-client-ts/linagora'
import {
  useId,
  useRef,
  useState,
  type SubmitEvent,
  type ReactElement
} from 'react'

import { ColorSwatchPicker } from '@/ds/ColorSwatchPicker/ColorSwatchPicker'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { validateIdentityName } from '@common/features/identities/identityForm'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { LABEL_COLORS } from './labelColors'
import { labelKeys, useLabels } from './queries'

export interface LabelDialogProps {
  /** The label to edit, null to create one */
  label: Label | null
  /** After a creation, with the label created (to apply it at once) */
  onCreated?: (label: Label) => void
  onClose: () => void
}

/** The problem with a label name: blank, spaces, or taken (any case) */
function validateLabelName(
  name: string,
  labels: readonly Label[],
  ownId: string | null
): TranslationKey | null {
  const problem = validateIdentityName(name)
  if (problem !== null) return problem
  const wanted = name.trim().toLocaleLowerCase()
  return labels.some(
    label =>
      label.id !== ownId &&
      label.displayName.trim().toLocaleLowerCase() === wanted
  )
    ? 'labels.errors.duplicate'
    : null
}

/**
 * Creates or edits a label, as tmail-flutter's label modal: a name (not
 * taken), an optional description and a colour among its swatches
 */
export function LabelDialog({
  label,
  onCreated,
  onClose
}: LabelDialogProps): ReactElement {
  const { t } = useI18n()
  const client = useJmapClient()
  const queryClient = useQueryClient()
  const { accountId } = useJmapSession()
  const { notify } = useNotify()
  const labels = useLabels().data?.list ?? []
  const titleId = useId()
  const subtitleId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(label?.displayName ?? '')
  const [description, setDescription] = useState(label?.description ?? '')
  const [color, setColor] = useState<string | null>(label?.color ?? null)
  const [isColorValid, setIsColorValid] = useState(true)
  const [isTouched, setIsTouched] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const hexRef = useRef<HTMLInputElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const problem = validateLabelName(name, labels, label?.id ?? null)
  const shownProblem = isTouched ? problem : null

  const save = async (): Promise<Label | null> => {
    const values = {
      displayName: name.trim(),
      description: description.trim() === '' ? null : description.trim(),
      color
    }
    if (label === null) {
      const response = await client.call('Label/set', {
        accountId,
        create: { label: values }
      })
      const created = response.created?.label
      return created
        ? { ...values, id: created.id, keyword: created.keyword ?? created.id }
        : null
    }
    // tmail-backend refuses a null colour: a colour cannot be taken off
    const { color: newColor, ...rest } = values
    const response = await client.call('Label/set', {
      accountId,
      update: { [label.id]: newColor === null ? rest : values }
    })
    return response.updated && label.id in response.updated
      ? { ...label, ...values, color: values.color ?? label.color }
      : null
  }

  const handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault()
    setIsTouched(true)
    setIsSubmitted(true)
    if (problem !== null) {
      nameRef.current?.focus()
      return
    }
    if (!isColorValid) {
      hexRef.current?.focus()
      return
    }
    setIsSaving(true)
    const failure = t(
      label === null ? 'labels.errors.create' : 'labels.errors.edit'
    )
    save()
      .then(async saved => {
        await queryClient.invalidateQueries({
          queryKey: labelKeys.all(accountId)
        })
        if (saved === null) {
          notify({ message: failure, severity: 'error' })
          setIsSaving(false)
          return
        }
        notify({
          message: t(
            label === null ? 'labels.toasts.created' : 'labels.toasts.edited',
            {
              labelName: saved.displayName
            }
          ),
          severity: 'success'
        })
        if (label === null) onCreated?.(saved)
        onClose()
      })
      .catch((error: unknown) => {
        console.error('[labels] Cannot save the label', error)
        notify({ message: failure, severity: 'error' })
        setIsSaving(false)
      })
  }

  return (
    <Dialog
      open
      onClose={isSaving ? undefined : onClose}
      size="medium"
      aria-labelledby={titleId}
      aria-describedby={subtitleId}
      data-testid="label-modal"
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle id={titleId}>
          {t(
            label === null ? 'labels.form.createTitle' : 'labels.form.editTitle'
          )}
        </DialogTitle>
        <DialogContent>
          <SecondaryText id={subtitleId} variant="body2" component="p">
            {t(
              label === null
                ? 'labels.form.createSubtitle'
                : 'labels.form.editSubtitle'
            )}
          </SecondaryText>
          <TextField
            inputRef={nameRef}
            autoFocus
            required
            fullWidth
            margin="dense"
            label={t('labels.form.name')}
            placeholder={t('labels.form.namePlaceholder')}
            value={name}
            onChange={event => {
              setName(event.target.value)
              setIsTouched(true)
            }}
            error={shownProblem !== null}
            helperText={shownProblem === null ? ' ' : t(shownProblem)}
            slotProps={{ htmlInput: { 'data-testid': 'label-name-input' } }}
          />
          <TextField
            fullWidth
            multiline
            minRows={2}
            margin="dense"
            label={t('labels.form.description')}
            placeholder={t('labels.form.descriptionPlaceholder')}
            value={description}
            onChange={event => {
              setDescription(event.target.value)
            }}
            slotProps={{
              htmlInput: { 'data-testid': 'label-description-input' }
            }}
          />
          <ColorSwatchPicker
            legend={t('labels.form.color')}
            swatches={LABEL_COLORS.map(({ name, value }) => ({
              value,
              label: t(`labels.colors.${name}`)
            }))}
            value={color}
            onChange={setColor}
            // tmail-backend refuses a null colour: a colour cannot be taken
            // off, so "No color" is only offered to a label without one
            noneLabel={
              (label?.color ?? null) === null
                ? t('labels.colorNone')
                : undefined
            }
            custom={{
              label: t('labels.colorCustom'),
              valueLabel: value =>
                t('labels.colorCustomNamed', { color: value }),
              hexLabel: t('labels.colorHex'),
              hint: t('labels.colorHexHint'),
              invalidMessage: t('labels.colorHexInvalid'),
              pickerLabel: t('labels.colorPicker'),
              showError: isSubmitted,
              onValidityChange: setIsColorValid,
              hexInputRef: hexRef,
              testIds: {
                swatch: 'label-color-custom',
                hexInput: 'label-color-hex-input',
                nativeInput: 'label-color-native-input'
              }
            }}
            data-testid="label-color-picker"
          />
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            color="inherit"
            onClick={onClose}
            disabled={isSaving}
            data-testid="label-cancel-button"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSaving}
            startIcon={
              isSaving ? <CircularProgress size={16} color="inherit" /> : null
            }
            data-testid="label-save-button"
          >
            {t(label === null ? 'labels.form.create' : 'common.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
