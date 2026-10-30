import { Calendar, Icon } from '@linagora/twake-icons'
import {
  Alert,
  Button,
  Checkbox,
  FixedDialog,
  FormControlLabel,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import {
  useId,
  useRef,
  useState,
  type SubmitEvent,
  type ReactElement
} from 'react'

import { formatDayText } from '@/ds/DateRangePicker/calendarDays'
import { DayRangeDialog } from '@common/features/dateRange/DayRangeDialog'
import type { DayRange } from '@common/features/dateRange/dayRange'
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
  type RecoveryForm,
  type RecoveryPeriod,
  type RecoveryRange
} from './recovery'

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
  const formId = useId()
  const descriptionId = useId()
  const deletionId = useId()
  const receptionId = useId()
  const subjectId = useId()
  const recipientsId = useId()
  const senderId = useId()
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
  const deletionRef = useRef<{ focus: () => void }>(null)
  const receptionRef = useRef<{ focus: () => void }>(null)
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
          startDate: formatDayText(period.start),
          endDate: formatDayText(period.end)
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
    label: string,
    period: RecoveryPeriod,
    ranges: readonly RecoveryRange[],
    setPeriod: (period: RecoveryPeriod) => void
  ): ReactElement => {
    const selectRef = field === 'deletion' ? deletionRef : receptionRef
    const id = field === 'deletion' ? deletionId : receptionId
    return (
      <div className="u-flex u-flex-items-center u-mt-1">
        <TextField
          id={id}
          select
          fullWidth
          label={label}
          value={period.range}
          inputRef={selectRef}
          slotProps={{
            select: {
              renderValue: () => periodLabel(period),
              SelectDisplayProps: {
                'data-testid': `recovery-${field}-select`
              } as Record<string, string>
            }
          }}
        >
          {ranges.map(range => (
            <MenuItem
              key={range}
              value={range}
              // On each pick: a custom range reopens when picked again
              onClick={() => {
                const preset = presetPeriod(range, ranges)
                if (preset === null) {
                  openRange(field, selectRef.current)
                  return
                }
                setPeriod(preset)
              }}
            >
              {t(RANGE_LABELS[range])}
            </MenuItem>
          ))}
        </TextField>
        <span className="u-ml-half u-flex">
          <Tooltip title={t('dateRange.selectDate')}>
            <IconButton
              aria-label={t('dateRange.selectDate')}
              aria-haspopup="dialog"
              aria-describedby={`${id}-label`}
              onClick={() => {
                // It gets the focus back by itself
                openRange(field, null)
              }}
              data-testid={`recovery-${field}-date-button`}
            >
              <Icon icon={Calendar} />
            </IconButton>
          </Tooltip>
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

  return (
    <>
      <FixedDialog
        open
        title={t('recovery.title')}
        fullScreen={false}
        aria-describedby={descriptionId}
        onClose={isSaving ? () => undefined : onClose}
        content={
          <form id={formId} onSubmit={handleSubmit} noValidate>
            <Typography id={descriptionId} component="p">
              {t('recovery.horizon', { period: horizon })}
            </Typography>
            {periodField(
              'deletion',
              t('recovery.deletionDate'),
              deletion,
              deletions,
              setDeletion
            )}
            {periodField(
              'reception',
              t('recovery.receptionDate'),
              reception,
              RECEPTION_RANGES,
              setReception
            )}
            <TextField
              id={subjectId}
              fullWidth
              className="u-mt-1"
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
              id={recipientsId}
              fullWidth
              className="u-mt-1"
              label={t('recovery.recipients')}
              placeholder={t('recovery.addressPlaceholder')}
              value={recipients}
              onChange={event => {
                setRecipients(event.target.value)
              }}
              error={recipientsProblem !== null}
              helperText={t(recipientsProblem ?? 'recovery.addressesHelp')}
              slotProps={{
                htmlInput: {
                  inputMode: 'email',
                  'data-testid': 'recovery-recipients-input'
                }
              }}
            />
            <TextField
              id={senderId}
              fullWidth
              className="u-mt-1"
              label={t('recovery.sender')}
              placeholder={t('recovery.addressPlaceholder')}
              value={sender}
              onChange={event => {
                setSender(event.target.value)
              }}
              error={senderProblem !== null}
              helperText={senderProblem === null ? undefined : t(senderProblem)}
              slotProps={{
                htmlInput: {
                  inputMode: 'email',
                  'data-testid': 'recovery-sender-input'
                }
              }}
            />
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
          </form>
        }
        actions={
          <>
            <Button
              variant="outlined"
              onClick={onClose}
              disabled={isSaving}
              data-testid="recovery-cancel-button"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form={formId}
              disabled={isSaving}
              data-testid="recovery-restore-button"
            >
              {t('recovery.restore')}
            </Button>
          </>
        }
        data-testid="recovery-dialog"
      />
      {rangeField === null ? null : (
        <DayRangeDialog
          initial={currentRange(
            rangeField === 'deletion' ? deletion : reception
          )}
          firstDay={
            rangeField === 'deletion' ? firstDeletionDay(horizon, now) : null
          }
          today={formatDay(now)}
          lastDay={formatDay(now)}
          onConfirm={confirmRange}
          onExited={() => {
            setRangeField(null)
            openerRef.current?.focus()
          }}
          testIdPrefix="recovery-range"
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
