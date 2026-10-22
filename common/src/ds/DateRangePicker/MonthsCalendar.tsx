// Upstream to twake-ui: yes, twake-mui has no calendar (MUI X's date pickers
// are not part of it). The month view of the date range picker: one month or
// two side by side, the month name between the arrows, the week from Monday,
// the start and the end of the range filled with the primary colour, today
// on `action.selected`. A grid of days as the APG date picker dialog: arrows,
// Home / End, Page Up / Page Down (a year with Shift), Enter or Space picks.
import { Icon } from '@linagora/twake-icons'
import { Box, IconButton, radius, Tooltip } from '@linagora/twake-mui'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement
} from 'react'

import { Left, Right } from '@/ds/FlutterIcons/FlutterIcons'

import {
  addDays,
  addMonths,
  dateOf,
  monthOf,
  monthWeeks,
  weekdayOf,
  type Day
} from './calendarDays'

export interface MonthsCalendarProps {
  /** One month (a phone), or two side by side */
  months: 1 | 2
  /** The first day of the first month shown */
  displayMonth: Day
  onDisplayMonthChange: (month: Day) => void
  /** The range picked so far; a single day has the same start and end */
  start: Day | null
  end: Day | null
  /** The days that can be picked, null for no bound */
  min?: Day | null
  max?: Day | null
  today: Day
  onPick: (day: Day) => void
  /** The language of the month and day names (`<html lang>`) */
  locale: string
  previousMonthLabel: string
  nextMonthLabel: string
  'data-testid'?: string
}

const CELL_HEIGHT = 36

function isBetween(day: Day, from: Day | null, to: Day | null): boolean {
  return from !== null && to !== null && day >= from && day <= to
}

/** The days of one or two months to pick a range from */
export function MonthsCalendar({
  months,
  displayMonth,
  onDisplayMonthChange,
  start,
  end,
  min = null,
  max = null,
  today,
  onPick,
  locale,
  previousMonthLabel,
  nextMonthLabel,
  'data-testid': testId
}: MonthsCalendarProps): ReactElement {
  const baseId = useId()
  const gridRef = useRef<HTMLDivElement>(null)
  const shouldFocusRef = useRef(false)
  const [focusedDay, setFocusedDay] = useState<Day>(start ?? today)
  // A new start (typed, a quick range) becomes the day the Tab key reaches
  const [shownStart, setShownStart] = useState(start)
  if (start !== shownStart) {
    setShownStart(start)
    if (start !== null) setFocusedDay(start)
  }
  const shownMonths = Array.from({ length: months }, (_, index) =>
    addMonths(monthOf(displayMonth), index)
  )
  const firstShown = shownMonths[0] ?? monthOf(displayMonth)
  const lastShown = shownMonths[shownMonths.length - 1] ?? firstShown
  const isShown = (day: Day): boolean =>
    monthOf(day) >= firstShown && monthOf(day) <= lastShown
  // The day the Tab key reaches: the focused one, else the first shown
  const tabDay = isShown(focusedDay) ? focusedDay : firstShown
  const isDisabled = (day: Day): boolean =>
    (min !== null && day < min) || (max !== null && day > max)

  const monthName = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric'
  })
  const dayName = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: 'long' })
  // A week from Monday: 2024-01-01 was one
  const week = Array.from({ length: 7 }, (_, index) =>
    dateOf(addDays('2024-01-01', index))
  )

  useEffect(() => {
    if (!shouldFocusRef.current) return
    shouldFocusRef.current = false
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-day="${focusedDay}"]`)
      ?.focus()
  }, [focusedDay, displayMonth])

  const moveFocus = (day: Day): void => {
    shouldFocusRef.current = true
    setFocusedDay(day)
    if (monthOf(day) < firstShown) onDisplayMonthChange(monthOf(day))
    else if (monthOf(day) > lastShown)
      onDisplayMonthChange(addMonths(monthOf(day), 1 - months))
  }

  const handleKeyDown = (event: KeyboardEvent, day: Day): void => {
    const moves: Record<string, () => Day> = {
      ArrowLeft: () => addDays(day, -1),
      ArrowRight: () => addDays(day, 1),
      ArrowUp: () => addDays(day, -7),
      ArrowDown: () => addDays(day, 7),
      Home: () => addDays(day, -weekdayOf(day)),
      End: () => addDays(day, 6 - weekdayOf(day)),
      PageUp: () => addMonths(day, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(day, event.shiftKey ? 12 : 1)
    }
    const move = moves[event.key]
    if (move !== undefined) {
      event.preventDefault()
      moveFocus(move())
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!isDisabled(day)) onPick(day)
    }
  }

  const navigate = (step: number): void => {
    onDisplayMonthChange(addMonths(firstShown, step))
  }

  return (
    <Box
      ref={gridRef}
      sx={{ display: 'flex', gap: '32px', width: '100%' }}
      data-testid={testId}
    >
      {shownMonths.map((month, index) => {
        const titleId = `${baseId}-${String(index)}`
        return (
          <Box
            key={month}
            sx={{
              flex: '1 1 0',
              minWidth: 0,
              position: 'relative',
              // The line between the two months
              '& + &::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: '-16px',
                borderLeft: '1px solid',
                borderColor: 'divider'
              }
            }}
          >
            <Box
              sx={{
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              {index === 0 ? (
                <NavArrow
                  label={previousMonthLabel}
                  isNext={false}
                  onClick={() => {
                    navigate(-1)
                  }}
                />
              ) : (
                <Box sx={{ width: 36 }} />
              )}
              <Box
                id={titleId}
                aria-live="polite"
                sx={{
                  typography: 'subtitle1',
                  color: 'text.primary',
                  textAlign: 'center',
                  '&::first-letter': { textTransform: 'uppercase' }
                }}
              >
                {monthName.format(dateOf(month))}
              </Box>
              {index === shownMonths.length - 1 ? (
                <NavArrow
                  label={nextMonthLabel}
                  isNext
                  onClick={() => {
                    navigate(1)
                  }}
                />
              ) : (
                <Box sx={{ width: 36 }} />
              )}
            </Box>
            <Box
              component="table"
              role="grid"
              aria-labelledby={titleId}
              sx={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: '0 2px',
                tableLayout: 'fixed'
              }}
            >
              <thead>
                <tr>
                  {week.map(date => (
                    <Box
                      component="th"
                      key={date.getDay()}
                      scope="col"
                      abbr={weekdayLong.format(date)}
                      sx={{
                        height: 32,
                        p: 0,
                        typography: 'subtitle2',
                        color: 'text.primary',
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'clip',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {weekdayShort.format(date)}
                    </Box>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthWeeks(month).map(days => (
                  <tr key={days.find(day => day !== null) ?? month}>
                    {days.map((day, column) =>
                      day === null ? (
                        <td key={`empty-${String(column)}`} />
                      ) : (
                        <DayCell
                          key={day}
                          day={day}
                          label={dayName.format(dateOf(day))}
                          isEdge={day === start || day === end}
                          isInRange={isBetween(day, start, end)}
                          isToday={day === today}
                          isDisabled={isDisabled(day)}
                          isTabStop={day === tabDay}
                          onFocus={() => {
                            setFocusedDay(day)
                          }}
                          onPick={() => {
                            setFocusedDay(day)
                            if (!isDisabled(day)) onPick(day)
                          }}
                          onKeyDown={event => {
                            handleKeyDown(event, day)
                          }}
                        />
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

interface NavArrowProps {
  label: string
  isNext: boolean
  onClick: () => void
}

function NavArrow({ label, isNext, onClick }: NavArrowProps): ReactElement {
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} onClick={onClick} size="small">
        <Icon icon={isNext ? Right : Left} size={24} />
      </IconButton>
    </Tooltip>
  )
}

interface DayCellProps {
  day: Day
  /** The whole date, its accessible name */
  label: string
  isEdge: boolean
  isInRange: boolean
  isToday: boolean
  isDisabled: boolean
  isTabStop: boolean
  onFocus: () => void
  onPick: () => void
  onKeyDown: (event: KeyboardEvent) => void
}

function DayCell({
  day,
  label,
  isEdge,
  isInRange,
  isToday,
  isDisabled,
  isTabStop,
  onFocus,
  onPick,
  onKeyDown
}: DayCellProps): ReactElement {
  return (
    <Box
      component="td"
      role="gridcell"
      data-day={day}
      tabIndex={isTabStop ? 0 : -1}
      aria-label={label}
      aria-selected={isInRange || isEdge}
      aria-disabled={isDisabled || undefined}
      aria-current={isToday ? 'date' : undefined}
      onFocus={onFocus}
      onClick={onPick}
      onKeyDown={onKeyDown}
      sx={{
        height: CELL_HEIGHT,
        p: 0,
        textAlign: 'center',
        typography: 'body2',
        lineHeight: `${String(CELL_HEIGHT)}px`,
        // A day inside the range joins its neighbours in one band
        borderRadius: isInRange && !isEdge ? 0 : radius.sm,
        cursor: isDisabled ? 'default' : 'pointer',
        userSelect: 'none',
        color: isEdge
          ? 'primary.contrastText'
          : isDisabled
            ? 'text.disabled'
            : 'text.primary',
        bgcolor: theme =>
          isEdge
            ? theme.vars.palette.primary.main
            : isInRange
              ? `color-mix(in srgb, ${theme.vars.palette.primary.main} 16%, transparent)`
              : isToday
                ? theme.vars.palette.action.selected
                : 'transparent',
        '&:hover': isEdge || isDisabled ? {} : { bgcolor: 'action.hover' }
      }}
    >
      {Number(day.slice(8))}
    </Box>
  )
}
