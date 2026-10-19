import {
  Alert,
  Checkbox,
  FormControlLabel,
  Typography
} from '@linagora/twake-mui'
import {
  useId,
  useRef,
  useState,
  type SubmitEvent,
  type ReactElement
} from 'react'

import { Calendar } from '@/ds/FlutterIcons/FlutterIcons'
import {
  ModalDialog,
  ModalDialogButton,
  ModalField,
  ModalFieldIconButton,
  ModalSelect,
  ModalTextInput,
  type ModalSelectHandle
} from '@/ds/ModalDialog/ModalDialog'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import {
  isValidEmail,
  parseRecipients
} from '@common/features/composer/recipients'
import { formatDay } from '@common/features/search/searchFilter'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'

import {
  deletionRanges,
  firstDeletionDay,
  RANGE_LABELS,
  RECEPTION_RANGES,
  type DayRange,
  type RecoveryForm,
  type RecoveryPeriod,
  type RecoveryRange
} from './recovery'
import { RecoveryRangeDialog } from './RecoveryRangeDialog'

export interface RecoveryDialogProps {
  /** Days back the vault restores from */
  horizon: number
  /** Starts the recovery; resolves false when the server refused it */
  onSubmit: (form: RecoveryForm) => Promise<boolean>
  onClose: () => void
  /** Today, for the periods; the current date by default */
  now?: Date
}

type PeriodField = 'deletion' | 'reception'

/** The period a pick of the menu sets: null for the custom range */
function presetPeriod(
  value: string,
  ranges: readonly RecoveryRange[]
): RecoveryPeriod | null {
  const range = ranges.find(candidate => candidate === value)
  if (range === undefined || range === 'customRange') return null
  return { range }
}

/**
 * "Recover deleted messages" of the Trash, as tmail-flutter's form: when
 * they were deleted (within the horizon of the vault) and received, a fixed
 * period or a custom range, their subject, recipients, sender and
 * attachments; they come back in the "Recovered" folder
 */
export function RecoveryDialog({
  horizon,
  onSubmit,
  onClose,
  now: givenNow
}: RecoveryDialogProps): ReactElement {
  const { t } = useI18n()
  const isPhone = useScreenSize() === 'mobile'
  const titleId = useId()
  const descriptionId = useId()
  const deletionLabelId = useId()
  const receptionLabelId = useId()
  const subjectId = useId()
  const recipientsId = useId()
  const recipientsErrorId = useId()
  const senderId = useId()
  const senderErrorId = useId()
  const [now] = useState(() => givenNow ?? new Date())
  const deletions = deletionRanges(horizon, now)
  const [deletion, setDeletion] = useState<RecoveryPeriod>(() => {
    const first = deletions[0]
    return first === undefined || first === 'customRange'
      ? { range: 'last7Days' }
      : { range: first }
  })
  const [reception, setReception] = useState<RecoveryPeriod>({
    range: 'allTime'
  })
  const [rangeField, setRangeField] = useState<PeriodField | null>(null)
  const deletionRef = useRef<ModalSelectHandle>(null)
  const receptionRef = useRef<ModalSelectHandle>(null)
  const openerRef = useRef<{ focus: () => void } | null>(null)
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

  const periodLabel = (period: RecoveryPeriod): string =>
    period.range === 'customRange'
      ? t('recovery.rangeValue', {
          startDate: period.start,
          endDate: period.end
        })
      : t(RANGE_LABELS[period.range])

  const openRange = (
    field: PeriodField,
    opener: { focus: () => void } | null
  ): void => {
    openerRef.current = opener
    setRangeField(field)
  }

  const periodField = (
    field: PeriodField,
    period: RecoveryPeriod,
    ranges: readonly RecoveryRange[],
    setPeriod: (period: RecoveryPeriod) => void
  ): ReactElement => {
    const selectRef = field === 'deletion' ? deletionRef : receptionRef
    const labelId = field === 'deletion' ? deletionLabelId : receptionLabelId
    return (
      <div className="u-flex u-flex-items-center u-flex-auto">
        <div className="u-flex-auto u-ov-hidden">
          <ModalSelect
            labelId={labelId}
            value={period.range}
            valueLabel={periodLabel(period)}
            options={ranges.map(range => ({
              value: range,
              label: t(RANGE_LABELS[range])
            }))}
            onChange={value => {
              const preset = presetPeriod(value, ranges)
              if (preset === null) {
                openRange(field, selectRef.current)
                return
              }
              setPeriod(preset)
            }}
            selectRef={selectRef}
            data-testid={`recovery-${field}-select`}
          />
        </div>
        <span className="u-ml-half u-flex">
          <ModalFieldIconButton
            label={t('recovery.selectDate')}
            icon={Calendar}
            aria-haspopup="dialog"
            aria-describedby={labelId}
            onClick={() => {
              // It gets the focus back by itself
              openRange(field, null)
            }}
            data-testid={`recovery-${field}-date-button`}
          />
        </span>
      </div>
    )
  }

  const confirmRange = (range: DayRange): void => {
    const period: RecoveryPeriod = { range: 'customRange', ...range }
    if (rangeField === 'deletion') setDeletion(period)
    if (rangeField === 'reception') setReception(period)
  }

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
  // start of the rows (above the fields on a phone)
  return (
    <>
      <ModalDialog
        title={t('recovery.title')}
        titleId={titleId}
        isTitleStrong
        subtitle={t('recovery.horizon', { period: horizon })}
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
          id={deletionLabelId}
          isInline={!isPhone}
          spaceAbove={8}
        >
          {periodField('deletion', deletion, deletions, setDeletion)}
        </ModalField>
        <ModalField
          label={t('recovery.receptionDate')}
          id={receptionLabelId}
          isInline={!isPhone}
          spaceAbove={12}
        >
          {periodField('reception', reception, RECEPTION_RANGES, setReception)}
        </ModalField>
        <ModalField
          label={t('recovery.subject')}
          htmlFor={subjectId}
          isInline={!isPhone}
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
          isInline={!isPhone}
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
          isInline={!isPhone}
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
          <Alert
            severity="error"
            className="u-mt-1"
            data-testid="recovery-error"
          >
            {t(problem)}
          </Alert>
        )}
      </ModalDialog>
      {rangeField === null ? null : (
        <RecoveryRangeDialog
          initial={currentRange(
            rangeField === 'deletion' ? deletion : reception
          )}
          firstDay={
            rangeField === 'deletion' ? firstDeletionDay(horizon, now) : null
          }
          lastDay={formatDay(now)}
          onConfirm={confirmRange}
          onExited={() => {
            setRangeField(null)
            openerRef.current?.focus()
          }}
          data-testid="recovery-range-dialog"
        />
      )}
    </>
  )
}

/** The days of a custom period, null for a fixed one */
function currentRange(period: RecoveryPeriod): DayRange | null {
  return period.range === 'customRange'
    ? { start: period.start, end: period.end }
    : null
}
