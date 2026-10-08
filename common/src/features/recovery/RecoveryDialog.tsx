import {
  Alert,
  Checkbox,
  FormControlLabel,
  Typography
} from '@linagora/twake-mui'
import { useId, useState, type SubmitEvent, type ReactElement } from 'react'

import {
  ModalDialog,
  ModalDialogButton,
  ModalField,
  ModalNativeSelect,
  ModalTextInput
} from '@/ds/ModalDialog/ModalDialog'
import {
  isValidEmail,
  parseRecipients
} from '@common/features/composer/recipients'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'

import {
  deletionRanges,
  RANGE_LABELS,
  RECEPTION_RANGES,
  type RecoveryForm,
  type RecoveryRange
} from './recovery'

export interface RecoveryDialogProps {
  /** Days back the vault restores from */
  horizon: number
  /** Starts the recovery; resolves false when the server refused it */
  onSubmit: (form: RecoveryForm) => Promise<boolean>
  onClose: () => void
}

function rangeOf(
  value: string,
  ranges: readonly RecoveryRange[]
): RecoveryRange {
  return ranges.find(range => range === value) ?? ranges[0] ?? 'allTime'
}

/**
 * "Recover deleted messages" of the Trash, as tmail-flutter's form: when
 * they were deleted (within the horizon of the vault) and received, their
 * subject, sender, recipients and attachments; they come back in the
 * "Recovered" folder
 */
export function RecoveryDialog({
  horizon,
  onSubmit,
  onClose
}: RecoveryDialogProps): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const descriptionId = useId()
  const deletionId = useId()
  const receptionId = useId()
  const subjectId = useId()
  const recipientsId = useId()
  const recipientsErrorId = useId()
  const senderId = useId()
  const senderErrorId = useId()
  const deletions = deletionRanges(horizon)
  const [deletion, setDeletion] = useState<RecoveryRange>(
    deletions[0] ?? 'last7Days'
  )
  const [reception, setReception] = useState<RecoveryRange>('allTime')
  const [subject, setSubject] = useState('')
  const [sender, setSender] = useState('')
  const [recipients, setRecipients] = useState('')
  const [hasAttachment, setHasAttachment] = useState(false)
  const [problem, setProblem] = useState<TranslationKey | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const senderAddresses = parseRecipients(sender).map(({ email }) => email)
  const recipientAddresses = parseRecipients(recipients).map(
    ({ email }) => email
  )
  const senderProblem = senderAddresses.every(isValidEmail)
    ? null
    : 'recovery.errors.invalidAddress'
  const recipientsProblem = recipientAddresses.every(isValidEmail)
    ? null
    : 'recovery.errors.invalidAddress'

  const handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault()
    if (senderProblem !== null || recipientsProblem !== null) return
    setIsSaving(true)
    setProblem(null)
    onSubmit({
      deletion,
      reception,
      subject,
      sender: senderAddresses[0] ?? null,
      recipients: recipientAddresses,
      hasAttachment
    })
      .then(isStarted => {
        if (isStarted) {
          onClose()
          return
        }
        setProblem('recovery.errors.start')
        setIsSaving(false)
      })
      .catch((error: unknown) => {
        console.error('[recovery] Cannot start', error)
        setProblem('recovery.errors.start')
        setIsSaving(false)
      })
  }

  // As tmail-flutter's recovery form (`EmailRecoveryFormDesktopBuilder`):
  // 576 px, the title in Semi Bold, the horizon under it, the labels at the
  // start of the rows
  return (
    <ModalDialog
      title={t('recovery.title')}
      titleId={titleId}
      isTitleStrong
      subtitle={t('recovery.horizon', {
        period: t('recovery.days', { smart_count: horizon })
      })}
      subtitleLook="body"
      describedBy={descriptionId}
      closeLabel={t('common.close')}
      onClose={isSaving ? () => undefined : onClose}
      onSubmit={handleSubmit}
      width={576}
      actions={
        <>
          <ModalDialogButton
            onClick={onClose}
            disabled={isSaving}
            data-testid="recovery-cancel-button"
          >
            {t('common.cancel')}
          </ModalDialogButton>
          <ModalDialogButton
            type="submit"
            isMain
            disabled={isSaving}
            data-testid="recovery-restore-button"
          >
            {t('recovery.restore')}
          </ModalDialogButton>
        </>
      }
      data-testid="recovery-dialog"
    >
      <ModalField
        label={t('recovery.deletionDate')}
        htmlFor={deletionId}
        isInline
        spaceAbove={8}
      >
        <ModalNativeSelect
          id={deletionId}
          value={deletion}
          onChange={value => {
            setDeletion(rangeOf(value, deletions))
          }}
          data-testid="recovery-deletion-select"
        >
          {deletions.map(range => (
            <option key={range} value={range}>
              {t(RANGE_LABELS[range])}
            </option>
          ))}
        </ModalNativeSelect>
      </ModalField>
      <ModalField
        label={t('recovery.receptionDate')}
        htmlFor={receptionId}
        isInline
        spaceAbove={12}
      >
        <ModalNativeSelect
          id={receptionId}
          value={reception}
          onChange={value => {
            setReception(rangeOf(value, RECEPTION_RANGES))
          }}
          data-testid="recovery-reception-select"
        >
          {RECEPTION_RANGES.map(range => (
            <option key={range} value={range}>
              {t(RANGE_LABELS[range])}
            </option>
          ))}
        </ModalNativeSelect>
      </ModalField>
      <ModalField
        label={t('recovery.subject')}
        htmlFor={subjectId}
        isInline
        spaceAbove={12}
      >
        <ModalTextInput
          id={subjectId}
          placeholder={t('recovery.subjectPlaceholder')}
          value={subject}
          onChange={event => {
            setSubject(event.target.value)
          }}
          inputProps={{ 'data-testid': 'recovery-subject-input' }}
        />
      </ModalField>
      <ModalField
        label={t('recovery.recipients')}
        htmlFor={recipientsId}
        isInline
        spaceAbove={12}
      >
        <ModalTextInput
          id={recipientsId}
          placeholder={t('recovery.addressPlaceholder')}
          value={recipients}
          onChange={event => {
            setRecipients(event.target.value)
          }}
          error={recipientsProblem === null ? null : t(recipientsProblem)}
          errorId={recipientsErrorId}
          inputProps={{
            inputMode: 'email',
            'aria-invalid': recipientsProblem !== null,
            'aria-describedby': recipientsErrorId,
            'data-testid': 'recovery-recipients-input'
          }}
        />
        {recipientsProblem === null ? (
          <Typography
            id={recipientsErrorId}
            variant="caption"
            color="textSecondary"
            className="u-db u-mt-half"
          >
            {t('recovery.addressesHelp')}
          </Typography>
        ) : null}
      </ModalField>
      <ModalField
        label={t('recovery.sender')}
        htmlFor={senderId}
        isInline
        spaceAbove={12}
      >
        <ModalTextInput
          id={senderId}
          placeholder={t('recovery.addressPlaceholder')}
          value={sender}
          onChange={event => {
            setSender(event.target.value)
          }}
          error={senderProblem === null ? null : t(senderProblem)}
          errorId={senderErrorId}
          inputProps={{
            inputMode: 'email',
            'aria-invalid': senderProblem !== null,
            'aria-describedby':
              senderProblem === null ? undefined : senderErrorId,
            'data-testid': 'recovery-sender-input'
          }}
        />
      </ModalField>
      <FormControlLabel
        className="u-mt-1"
        control={
          <Checkbox
            checked={hasAttachment}
            onChange={event => {
              setHasAttachment(event.target.checked)
            }}
          />
        }
        label={t('recovery.hasAttachment')}
      />
      {problem === null ? null : (
        <Alert severity="error" className="u-mt-1" data-testid="recovery-error">
          {t(problem)}
        </Alert>
      )}
    </ModalDialog>
  )
}
