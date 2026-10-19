import { useRef, useState, type ReactElement } from 'react'

import {
  addDays,
  addMonths,
  formatDayText,
  parseDayText
} from '@/ds/DateRangePicker/calendarDays'
import {
  DateRangePickerDialog,
  type DateRangePreset
} from '@/ds/DateRangePicker/DateRangePickerDialog'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'

import {
  dayRangeProblems,
  RANGE_LABELS,
  type DayRange,
  type DayRangeProblem
} from './recovery'

const PROBLEM_LABELS: Record<DayRangeProblem, TranslationKey> = {
  startMissing: 'recovery.errors.startMissing',
  endMissing: 'recovery.errors.endMissing',
  reversed: 'recovery.errors.reversed',
  beforeHorizon: 'recovery.errors.beforeHorizon'
}

export interface RecoveryRangeDialogProps {
  /** The range chosen before, null for none */
  initial: DayRange | null
  /** The first day it can start on (the horizon of the vault), or null */
  firstDay: string | null
  /** The last day it can end on, today */
  lastDay: string
  onConfirm: (range: DayRange) => void
  /** Once it is gone: the focus goes back to what opened it */
  onExited: () => void
  'data-testid'?: string
}

/**
 * The custom range of a period of the recovery form: tmail-flutter's date
 * range picker (`DateRangePickerMixin`), its quick ranges, two months and
 * two `dd/mm/yyyy` fields. Refused when a day is missing or not a day, when
 * the end comes before the start or when the start is past the horizon of
 * the vault; each problem shows under the fields, tied to its own, and the
 * focus goes there
 */
export function RecoveryRangeDialog({
  initial,
  firstDay,
  lastDay,
  onConfirm,
  onExited,
  'data-testid': testId
}: RecoveryRangeDialogProps): ReactElement {
  const { t, lang } = useI18n()
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(true)
  const [startText, setStartText] = useState(
    initial === null ? '' : formatDayText(initial.start)
  )
  const [endText, setEndText] = useState(
    initial === null ? '' : formatDayText(initial.end)
  )
  const [isSubmitted, setIsSubmitted] = useState(false)
  const range = {
    start: parseDayText(startText) ?? '',
    end: parseDayText(endText) ?? ''
  }
  const problems = dayRangeProblems(range, firstDay)
  const startProblem = isSubmitted ? problems.start : null
  const endProblem = isSubmitted ? problems.end : null

  // tmail-flutter's quick ranges (`DateRangeType`), up to today
  const presets: DateRangePreset[] = [
    { label: t(RANGE_LABELS.last7Days), start: addDays(lastDay, -7) },
    { label: t(RANGE_LABELS.last30Days), start: addDays(lastDay, -30) },
    { label: t(RANGE_LABELS.last6Months), start: addMonths(lastDay, -6) },
    { label: t(RANGE_LABELS.last1Year), start: addMonths(lastDay, -12) }
  ].map(preset => ({ ...preset, end: lastDay }))

  const close = (): void => {
    setOpen(false)
  }

  const submit = (): void => {
    setIsSubmitted(true)
    if (problems.start !== null) {
      startRef.current?.focus()
      return
    }
    if (problems.end !== null) {
      endRef.current?.focus()
      return
    }
    setOpen(false)
    onConfirm(range)
  }

  const problemText = (problem: DayRangeProblem | null): string | null =>
    problem === null
      ? null
      : t(PROBLEM_LABELS[problem], {
          date: firstDay === null ? '' : formatDayText(firstDay)
        })

  return (
    <DateRangePickerDialog
      open={open}
      labels={{
        dialog: t('recovery.ranges.customRange'),
        start: t('recovery.startDate'),
        end: t('recovery.endDate'),
        hint: t('recovery.dateHint'),
        cancel: t('common.cancel'),
        confirm: t('recovery.setDate'),
        previousMonth: t('recovery.previousMonth'),
        nextMonth: t('recovery.nextMonth'),
        pickDate: t('recovery.selectDate'),
        close: t('common.close')
      }}
      locale={lang}
      today={lastDay}
      min={firstDay}
      max={lastDay}
      presets={presets}
      startText={startText}
      endText={endText}
      onStartTextChange={setStartText}
      onEndTextChange={setEndText}
      startError={problemText(startProblem)}
      endError={problemText(endProblem)}
      startInputRef={startRef}
      endInputRef={endRef}
      onSubmit={submit}
      onClose={close}
      onExited={onExited}
      data-testid={testId}
      testIds={{
        start: 'recovery-range-start-input',
        end: 'recovery-range-end-input',
        cancel: 'recovery-range-cancel-button',
        confirm: 'recovery-range-confirm-button'
      }}
    />
  )
}
