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
  type DayRange,
  type DayRangeProblem
} from './dayRange'

const PROBLEM_LABELS: Record<DayRangeProblem, TranslationKey> = {
  startMissing: 'dateRange.errors.startMissing',
  endMissing: 'dateRange.errors.endMissing',
  reversed: 'dateRange.errors.reversed',
  beforeHorizon: 'dateRange.errors.beforeHorizon'
}

export interface DayRangeDialogProps {
  /** The range chosen before, null for none */
  initial: DayRange | null
  /** Today (`YYYY-MM-DD`): the quick ranges end on it */
  today: string
  /** The first day it can start on (e.g. the horizon of a vault), or null */
  firstDay?: string | null
  /** The last day it can end on, or null */
  lastDay?: string | null
  onConfirm: (range: DayRange) => void
  /** Once it is gone: the focus goes back to what opened it */
  onExited: () => void
  /**
   * Of the test ids: `<prefix>-dialog`, `<prefix>-start-input`,
   * `<prefix>-end-input`, `<prefix>-cancel-button`, `<prefix>-confirm-button`
   */
  testIdPrefix: string
}

/**
 * A custom range of days, as tmail-flutter picks one
 * (`DateRangePickerMixin.showMultipleViewDateRangePicker`): its quick ranges,
 * two months and two `dd/mm/yyyy` fields. Refused when a day is missing or
 * not a day, when the end comes before the start or when the start is before
 * `firstDay`; each problem shows under the fields, tied to its own, and the
 * focus goes there
 */
export function DayRangeDialog({
  initial,
  today,
  firstDay = null,
  lastDay = null,
  onConfirm,
  onExited,
  testIdPrefix
}: DayRangeDialogProps): ReactElement {
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
    { label: t('dateRange.ranges.last7Days'), start: addDays(today, -7) },
    { label: t('dateRange.ranges.last30Days'), start: addDays(today, -30) },
    { label: t('dateRange.ranges.last6Months'), start: addMonths(today, -6) },
    { label: t('dateRange.ranges.last1Year'), start: addMonths(today, -12) }
  ].map(preset => ({ ...preset, end: today }))

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
        dialog: t('dateRange.title'),
        start: t('dateRange.startDate'),
        end: t('dateRange.endDate'),
        hint: t('dateRange.dateHint'),
        cancel: t('common.cancel'),
        confirm: t('dateRange.setDate'),
        previousMonth: t('dateRange.previousMonth'),
        nextMonth: t('dateRange.nextMonth'),
        pickDate: t('dateRange.selectDate'),
        close: t('common.close')
      }}
      locale={lang}
      today={today}
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
      data-testid={`${testIdPrefix}-dialog`}
      testIds={{
        start: `${testIdPrefix}-start-input`,
        end: `${testIdPrefix}-end-input`,
        cancel: `${testIdPrefix}-cancel-button`,
        confirm: `${testIdPrefix}-confirm-button`
      }}
    />
  )
}
