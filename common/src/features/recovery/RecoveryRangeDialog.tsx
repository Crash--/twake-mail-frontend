import {
  useId,
  useRef,
  useState,
  type ReactElement,
  type SubmitEvent
} from 'react'

import {
  ModalDialog,
  ModalDialogButton,
  ModalField,
  ModalTextInput
} from '@/ds/ModalDialog/ModalDialog'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'

import {
  dayRangeProblems,
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
 * The custom range of a period of the recovery form (tmail-flutter's date
 * range picker, `DateRangePickerMixin`): a start and an end date, refused
 * when one is missing, when the end comes before the start or when the
 * start is past the horizon of the vault; each problem shows under its
 * date, tied to it, and the focus goes there
 */
export function RecoveryRangeDialog({
  initial,
  firstDay,
  lastDay,
  onConfirm,
  onExited,
  'data-testid': testId
}: RecoveryRangeDialogProps): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const startId = useId()
  const startErrorId = useId()
  const endId = useId()
  const endErrorId = useId()
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(true)
  const [start, setStart] = useState(initial?.start ?? '')
  const [end, setEnd] = useState(initial?.end ?? '')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const problems = dayRangeProblems({ start, end }, firstDay)
  const startProblem = isSubmitted ? problems.start : null
  const endProblem = isSubmitted ? problems.end : null

  const close = (): void => {
    setOpen(false)
  }

  const handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault()
    // Its form is in a portal: the recovery form must not see this submit
    event.stopPropagation()
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
    onConfirm({ start, end })
  }

  const problemText = (problem: DayRangeProblem | null): string | null =>
    problem === null
      ? null
      : t(PROBLEM_LABELS[problem], { date: firstDay ?? '' })

  return (
    <ModalDialog
      open={open}
      title={t('recovery.ranges.customRange')}
      titleId={titleId}
      size="small"
      closeLabel={t('common.close')}
      onClose={close}
      onExited={onExited}
      onSubmit={handleSubmit}
      actions={
        <>
          <ModalDialogButton
            onClick={close}
            data-testid="recovery-range-cancel-button"
          >
            {t('common.cancel')}
          </ModalDialogButton>
          <ModalDialogButton
            type="submit"
            isMain
            data-testid="recovery-range-confirm-button"
          >
            {t('recovery.setDate')}
          </ModalDialogButton>
        </>
      }
      data-testid={testId}
    >
      <ModalField
        label={t('recovery.startDate')}
        htmlFor={startId}
        spaceAbove={0}
      >
        <ModalTextInput
          id={startId}
          type="date"
          value={start}
          onChange={event => {
            setStart(event.target.value)
          }}
          error={problemText(startProblem)}
          errorId={startErrorId}
          inputRef={startRef}
          inputProps={{
            min: firstDay ?? undefined,
            max: lastDay,
            'aria-invalid': startProblem !== null,
            'aria-describedby':
              startProblem === null ? undefined : startErrorId,
            'data-testid': 'recovery-range-start-input'
          }}
        />
      </ModalField>
      <ModalField label={t('recovery.endDate')} htmlFor={endId}>
        <ModalTextInput
          id={endId}
          type="date"
          value={end}
          onChange={event => {
            setEnd(event.target.value)
          }}
          error={problemText(endProblem)}
          errorId={endErrorId}
          inputRef={endRef}
          inputProps={{
            min: firstDay ?? undefined,
            max: lastDay,
            'aria-invalid': endProblem !== null,
            'aria-describedby': endProblem === null ? undefined : endErrorId,
            'data-testid': 'recovery-range-end-input'
          }}
        />
      </ModalField>
    </ModalDialog>
  )
}
