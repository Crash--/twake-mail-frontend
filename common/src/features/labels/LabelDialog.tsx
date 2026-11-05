import { Button, COLORS, TextField, Typography } from '@linagora/twake-mui'
import { useQueryClient } from '@tanstack/react-query'
import type { Label } from 'jmap-client-ts/linagora'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type SubmitEvent,
  type ReactElement
} from 'react'

import { ColorPopoverPicker } from '@/ds/ColorPopoverPicker/ColorPopoverPicker'
import { normalizeHexColor } from '@/ds/ColorSwatchPicker/hexColor'
import { ModalDialog } from '@/ds/ModalDialog/ModalDialog'
import { StackedField } from '@/ds/StackedField/StackedField'
import { validateIdentityName } from '@common/features/identities/identityForm'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { labelKeys, useLabels } from './queries'

export interface LabelDialogProps {
  /** The label to edit, null to create one */
  label: Label | null
  /** After a creation, with the label created (to apply it at once) */
  onCreated?: (label: Label) => void
  onClose: () => void
}

const COLOR_NAMES: Record<string, TranslationKey> = {
  '#273891': 'labels.colors.navyBlue',
  '#7E57E3': 'labels.colors.purple',
  '#9E83E8': 'labels.colors.lavender',
  '#91CEF6': 'labels.colors.skyBlue',
  '#2D83FF': 'labels.colors.brightBlue',
  '#006BD8': 'labels.colors.royalBlue',
  '#038199': 'labels.colors.petrolBlue',
  '#51B588': 'labels.colors.green',
  '#457D6C': 'labels.colors.darkGreen',
  '#1EBBCC': 'labels.colors.turquoise',
  '#E0465C': 'labels.colors.red',
  '#ED20A4': 'labels.colors.magenta',
  '#ED768D': 'labels.colors.pink',
  '#B85B17': 'labels.colors.brown',
  '#EDA91D': 'labels.colors.orange',
  '#BA8144': 'labels.colors.lightBrown',
  '#ED916B': 'labels.colors.salmon',
  '#EDC661': 'labels.colors.yellow',
  '#131326': 'labels.colors.black',
  '#646580': 'labels.colors.grey'
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
  const formId = useId()
  const nameId = useId()
  const descriptionId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(label?.displayName ?? '')
  const [description, setDescription] = useState(label?.description ?? '')
  const [color, setColor] = useState<string | null>(label?.color ?? null)
  // A colour out of the list stays as it is, in the custom field
  const [isCustom, setIsCustom] = useState(
    color !== null && !COLORS.includes(color.toUpperCase())
  )
  const [hex, setHex] = useState(color ?? '')
  const isColorValid = !isCustom || normalizeHexColor(hex) !== null
  const [isTouched, setIsTouched] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const hexRef = useRef<HTMLInputElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  // The dialog takes the focus as it opens: the name gets it once there
  useEffect(() => {
    const timer = window.setTimeout(() => {
      nameRef.current?.focus()
    }, 0)
    return () => {
      window.clearTimeout(timer)
    }
  }, [])
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

  const colorName = (value: string): string => {
    const key = COLOR_NAMES[value.toUpperCase()]
    return key === undefined ? value : t(key)
  }

  const nameField = (
    <StackedField label={t('labels.form.name')} htmlFor={nameId}>
      <div className="u-flex u-flex-items-start">
        <TextField
          id={nameId}
          inputRef={nameRef}
          required
          fullWidth
          size="small"
          placeholder={t('labels.form.namePlaceholder')}
          value={name}
          onChange={event => {
            setName(event.target.value)
            setIsTouched(true)
          }}
          error={shownProblem !== null}
          helperText={shownProblem === null ? undefined : t(shownProblem)}
          slotProps={{ htmlInput: { 'data-testid': 'label-name-input' } }}
        />
        <span className="u-ml-half u-flex">
          <ColorPopoverPicker
            buttonLabel={t('labels.form.colorCurrent', {
              color: color === null ? t('labels.colorNone') : colorName(color)
            })}
            groupLabel={t('labels.form.color')}
            swatches={COLORS.map(value => ({ value, label: colorName(value) }))}
            value={color}
            // tmail-backend refuses a null colour: a colour cannot be taken
            // off, so "No color" is only offered to a label without one
            noneLabel={
              (label?.color ?? null) === null ? t('labels.colorNone') : null
            }
            customLabel={t('labels.colorHex')}
            isCustom={isCustom}
            onChange={picked => {
              setIsCustom(false)
              setColor(picked)
            }}
            onCustom={() => {
              setIsCustom(true)
              setHex(color ?? '')
            }}
            data-testid="label-color-picker"
          />
        </span>
      </div>
    </StackedField>
  )

  return (
    <ModalDialog
      open
      title={t(
        label === null ? 'labels.form.createTitle' : 'labels.form.editTitle'
      )}
      fullScreen={false}
      onClose={isSaving ? () => undefined : onClose}
      content={
        <form id={formId} onSubmit={handleSubmit} noValidate>
          <Typography component="p" className="u-mb-1-half">
            {t(
              label === null
                ? 'labels.form.createSubtitle'
                : 'labels.form.editSubtitle'
            )}
          </Typography>
          {nameField}
          {isCustom ? (
            <TextField
              fullWidth
              size="small"
              className="u-mt-1"
              label={t('labels.colorHex')}
              value={hex}
              inputRef={hexRef}
              onChange={event => {
                setHex(event.target.value)
                const typed = normalizeHexColor(event.target.value)
                if (typed !== null) setColor(typed)
              }}
              error={isSubmitted && !isColorValid}
              helperText={t(
                isSubmitted && !isColorValid
                  ? 'labels.colorHexInvalid'
                  : 'labels.colorHexHint'
              )}
              slotProps={{
                htmlInput: { 'data-testid': 'label-color-hex-input' },
                formHelperText:
                  isSubmitted && !isColorValid ? { role: 'alert' } : undefined
              }}
            />
          ) : null}
          <StackedField
            label={t('labels.form.description')}
            htmlFor={descriptionId}
            className="u-mt-1-half"
          >
            <TextField
              id={descriptionId}
              multiline
              fullWidth
              size="small"
              placeholder={t('labels.form.descriptionPlaceholder')}
              value={description}
              onChange={event => {
                setDescription(event.target.value)
              }}
              slotProps={{
                htmlInput: { 'data-testid': 'label-description-input' }
              }}
            />
          </StackedField>
        </form>
      }
      actions={
        <>
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={isSaving}
            data-testid="label-cancel-button"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            // As tmail-flutter: greyed out until the label has a name
            disabled={isSaving || name.trim() === ''}
            data-testid="label-save-button"
          >
            {t(label === null ? 'labels.form.create' : 'common.save')}
          </Button>
        </>
      }
      data-testid="label-modal"
    />
  )
}
