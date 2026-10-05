import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField
} from '@linagora/twake-mui'
import { useId, useState, type SubmitEvent, type ReactElement } from 'react'

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

  return (
    <Dialog
      open
      onClose={isSaving ? undefined : onClose}
      size="medium"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-testid="recovery-dialog"
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle id={titleId}>{t('recovery.title')}</DialogTitle>
        <DialogContent>
          <Alert severity="info" id={descriptionId} className="u-mb-1">
            {t('recovery.horizon', {
              period: t('recovery.days', { smart_count: horizon })
            })}
          </Alert>
          <TextField
            select
            fullWidth
            margin="dense"
            label={t('recovery.deletionDate')}
            value={deletion}
            onChange={event => {
              setDeletion(rangeOf(event.target.value, deletions))
            }}
            slotProps={{
              select: { native: true },
              htmlInput: { 'data-testid': 'recovery-deletion-select' }
            }}
          >
            {deletions.map(range => (
              <option key={range} value={range}>
                {t(RANGE_LABELS[range])}
              </option>
            ))}
          </TextField>
          <TextField
            select
            fullWidth
            margin="dense"
            label={t('recovery.receptionDate')}
            value={reception}
            onChange={event => {
              setReception(rangeOf(event.target.value, RECEPTION_RANGES))
            }}
            slotProps={{
              select: { native: true },
              htmlInput: { 'data-testid': 'recovery-reception-select' }
            }}
          >
            {RECEPTION_RANGES.map(range => (
              <option key={range} value={range}>
                {t(RANGE_LABELS[range])}
              </option>
            ))}
          </TextField>
          <TextField
            fullWidth
            margin="dense"
            label={t('recovery.subject')}
            placeholder={t('recovery.subjectPlaceholder')}
            value={subject}
            onChange={event => {
              setSubject(event.target.value)
            }}
            slotProps={{
              htmlInput: { 'data-testid': 'recovery-subject-input' }
            }}
          />
          <TextField
            fullWidth
            margin="dense"
            label={t('recovery.recipients')}
            placeholder={t('recovery.addressPlaceholder')}
            value={recipients}
            onChange={event => {
              setRecipients(event.target.value)
            }}
            error={recipientsProblem !== null}
            helperText={
              recipientsProblem === null
                ? t('recovery.addressesHelp')
                : t(recipientsProblem)
            }
            slotProps={{
              htmlInput: {
                inputMode: 'email',
                'data-testid': 'recovery-recipients-input'
              }
            }}
          />
          <TextField
            fullWidth
            margin="dense"
            label={t('recovery.sender')}
            placeholder={t('recovery.addressPlaceholder')}
            value={sender}
            onChange={event => {
              setSender(event.target.value)
            }}
            error={senderProblem !== null}
            helperText={senderProblem === null ? ' ' : t(senderProblem)}
            slotProps={{
              htmlInput: {
                inputMode: 'email',
                'data-testid': 'recovery-sender-input'
              }
            }}
          />
          <FormControlLabel
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
            <Alert
              severity="error"
              className="u-mt-1"
              data-testid="recovery-error"
            >
              {t(problem)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            color="inherit"
            onClick={onClose}
            disabled={isSaving}
            data-testid="recovery-cancel-button"
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
            data-testid="recovery-restore-button"
          >
            {t('recovery.restore')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
