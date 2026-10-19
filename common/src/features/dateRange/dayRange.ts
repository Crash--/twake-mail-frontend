import { fromLocalInputs } from '@common/features/vacation/vacation'

/** Days (`YYYY-MM-DD`, local) of a custom range, both included */
export interface DayRange {
  start: string
  end: string
}

/** Why a custom range is refused */
export type DayRangeProblem =
  'startMissing' | 'endMissing' | 'reversed' | 'beforeHorizon'

/** A valid `YYYY-MM-DD` day */
function isDay(day: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) && fromLocalInputs(day, '00:00') !== null
  )
}

/**
 * What is wrong with a custom range, for its start and its end: a missing or
 * invalid day, a start before `firstDay` (e.g. the horizon of the vault, null
 * for none), an end before the start
 */
export function dayRangeProblems(
  range: DayRange,
  firstDay: string | null
): { start: DayRangeProblem | null; end: DayRangeProblem | null } {
  const isStartValid = isDay(range.start)
  const start: DayRangeProblem | null = !isStartValid
    ? 'startMissing'
    : firstDay !== null && range.start < firstDay
      ? 'beforeHorizon'
      : null
  const end: DayRangeProblem | null = !isDay(range.end)
    ? 'endMissing'
    : isStartValid && range.end < range.start
      ? 'reversed'
      : null
  return { start, end }
}
