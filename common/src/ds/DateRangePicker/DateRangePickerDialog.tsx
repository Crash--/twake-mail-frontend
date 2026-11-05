// Upstream to twake-ui: yes, twake-mui has no date range picker. A dialog
// with the quick ranges as square chips and a close button at the top, two
// months side by side, the start and end fields (`dd/mm/yyyy`) joined by a
// small arrow, and at the bottom "Cancel" and "Set date". On a phone it is a
// sheet at the bottom with the quick ranges and the two fields only, each
// opening a one month calendar sheet from its calendar icon.
import { Icon, Calendar, Cross, Next } from '@linagora/twake-icons'
import {
  Box,
  Button,
  Chip,
  Dialog,
  IconButton,
  radius,
  TextField,
  type Theme,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import {
  useId,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
  type SubmitEvent
} from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

import {
  formatDayText,
  maskDayText,
  monthOf,
  addMonths,
  parseDayText,
  type Day
} from './calendarDays'
import { MonthsCalendar } from './MonthsCalendar'

/** A quick range of the top row ("Last 7 days"…) */
export interface DateRangePreset {
  label: string
  start: Day
  end: Day
}

export interface DateRangePickerDialogLabels {
  /** The accessible name of the dialog */
  dialog: string
  start: string
  end: string
  /** The placeholder of the fields, e.g. "dd/mm/yyyy" */
  hint: string
  cancel: string
  confirm: string
  previousMonth: string
  nextMonth: string
  /** The calendar button of a field, on a phone */
  pickDate: string
  close: string
}

export interface DateRangePickerDialogProps {
  open?: boolean
  labels: DateRangePickerDialogLabels
  /** The language of the month and day names */
  locale: string
  today: Day
  /** The days the calendar lets pick, null for no bound */
  min?: Day | null
  max?: Day | null
  presets: readonly DateRangePreset[]
  /** The fields, as typed (`dd/mm/yyyy`) */
  startText: string
  endText: string
  onStartTextChange: (text: string) => void
  onEndTextChange: (text: string) => void
  /** Shown under the fields and tied to them, null for none */
  startError?: string | null
  endError?: string | null
  startInputRef?: Ref<HTMLInputElement>
  endInputRef?: Ref<HTMLInputElement>
  /** "Set date": the caller checks the fields and closes */
  onSubmit: () => void
  onClose: () => void
  /** Once it is gone: the focus goes back to what opened it */
  onExited?: () => void
  'data-testid'?: string
  testIds?: {
    start?: string
    end?: string
    cancel?: string
    confirm?: string
  }
}

const VISUALLY_HIDDEN = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap'
} as const

const SHEET_RADIUS = `${radius.lg} ${radius.lg} 0 0`

/** The Figma's quick range: the search filter chip, pale primary once picked */
const PRESET_SX = (isSelected: boolean): Record<string, unknown> => ({
  flexShrink: 0,
  typography: 'caption',
  fontWeight: 500,
  '& .MuiChip-label': { px: 1.5 },
  ...(isSelected
    ? {
        color: 'primary.main',
        bgcolor: (theme: Theme) =>
          `color-mix(in srgb, ${theme.vars.palette.primary.main} 8%, transparent)`,
        '&:hover, &.Mui-focusVisible': {
          bgcolor: (theme: Theme) =>
            `color-mix(in srgb, ${theme.vars.palette.primary.main} 16%, transparent)`
        }
      }
    : { bgcolor: 'background.default' })
})

/**
 * A range of days, picked on the calendar, typed in its two fields or taken
 * from a quick range: what the fields hold is what "Set date" submits
 */
export function DateRangePickerDialog({
  open = true,
  labels,
  locale,
  today,
  min = null,
  max = null,
  presets,
  startText,
  endText,
  onStartTextChange,
  onEndTextChange,
  startError = null,
  endError = null,
  startInputRef,
  endInputRef,
  onSubmit,
  onClose,
  onExited,
  'data-testid': testId,
  testIds = {}
}: DateRangePickerDialogProps): ReactElement {
  const isPhone = useScreenSize() === 'mobile'
  const titleId = useId()
  const sheetTitleId = useId()
  const startId = useId()
  const endId = useId()
  const startErrorId = useId()
  const endErrorId = useId()
  const start = parseDayText(startText)
  const end = parseDayText(endText)
  const [displayMonth, setDisplayMonth] = useState<Day>(() =>
    monthOf(start ?? addMonths(today, -1))
  )
  const [presetIndex, setPresetIndex] = useState<number | null>(null)
  const [phonePicker, setPhonePicker] = useState<'start' | 'end' | null>(null)

  const setRange = (from: Day | null, to: Day | null): void => {
    onStartTextChange(from === null ? '' : formatDayText(from))
    onEndTextChange(to === null ? '' : formatDayText(to))
  }

  // As Syncfusion's range selection: a first day starts the range, a second
  // one ends it (before the first, they swap), a third starts a new one
  const pick = (day: Day): void => {
    setPresetIndex(null)
    if (start === null || end !== null) setRange(day, null)
    else if (day < start) setRange(day, start)
    else setRange(start, day)
  }

  // The one month calendar of a field opens on its day, else on today
  const openPhonePicker = (field: 'start' | 'end'): void => {
    setDisplayMonth(monthOf((field === 'start' ? start : end) ?? today))
    setPhonePicker(field)
  }

  const pickPreset = (index: number): void => {
    const preset = presets[index]
    if (preset === undefined) return
    setPresetIndex(index)
    setRange(preset.start, preset.end)
    setDisplayMonth(monthOf(isPhone ? preset.start : addMonths(preset.end, -1)))
  }

  const typeStart = (text: string): void => {
    setPresetIndex(null)
    const masked = maskDayText(text)
    onStartTextChange(masked)
    const day = parseDayText(masked)
    if (day !== null) setDisplayMonth(monthOf(day))
  }

  const typeEnd = (text: string): void => {
    setPresetIndex(null)
    onEndTextChange(maskDayText(text))
  }

  const handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault()
    // Its form is in a portal: a form of the page must not see this submit
    event.stopPropagation()
    onSubmit()
  }

  const describedBy = (error: string | null, id: string): string | undefined =>
    error === null ? undefined : id

  const startField = (
    <DateField
      id={startId}
      label={labels.start}
      hint={labels.hint}
      value={startText}
      onChange={typeStart}
      hasError={startError !== null}
      describedBy={describedBy(startError, startErrorId)}
      inputRef={startInputRef}
      isAutoFocus={!isPhone}
      isWide={isPhone}
      pickLabel={isPhone ? labels.pickDate : null}
      onPick={() => {
        openPhonePicker('start')
      }}
      data-testid={testIds.start}
    />
  )
  const endField = (
    <DateField
      id={endId}
      label={labels.end}
      hint={labels.hint}
      value={endText}
      onChange={typeEnd}
      hasError={endError !== null}
      describedBy={describedBy(endError, endErrorId)}
      inputRef={endInputRef}
      isAutoFocus={false}
      isWide={isPhone}
      pickLabel={isPhone ? labels.pickDate : null}
      onPick={() => {
        openPhonePicker('end')
      }}
      data-testid={testIds.end}
    />
  )
  const errors = (
    <>
      <FieldError id={startErrorId} text={startError} />
      <FieldError id={endErrorId} text={endError} />
    </>
  )
  const buttons = (
    <Box
      sx={{
        display: 'flex',
        gap: '8px',
        flex: isPhone ? '1 1 100%' : '0 0 auto',
        ml: isPhone ? 0 : 'auto'
      }}
    >
      <PickerButton
        isMain={false}
        isWide={isPhone}
        onClick={onClose}
        data-testid={testIds.cancel}
      >
        {labels.cancel}
      </PickerButton>
      <PickerButton
        isMain
        isWide={isPhone}
        type="submit"
        data-testid={testIds.confirm}
      >
        {labels.confirm}
      </PickerButton>
    </Box>
  )

  const phonePickedDay = phonePicker === 'start' ? start : end
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      slotProps={{
        paper: isPhone
          ? {
              sx: {
                m: 0,
                mt: 'auto',
                width: '100%',
                maxWidth: '100%',
                borderRadius: SHEET_RADIUS
              }
            }
          : undefined,
        transition: { onExited }
      }}
      data-testid={testId}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        {/* No visible title: the dialog still has its name */}
        <Typography id={titleId} component="h2" sx={VISUALLY_HIDDEN}>
          {labels.dialog}
        </Typography>
        <Box
          sx={
            isPhone
              ? undefined
              : {
                  display: 'flex',
                  alignItems: 'center',
                  py: '18px',
                  px: '32px'
                }
          }
        >
          <PresetRow
            presets={presets}
            selected={presetIndex}
            isPhone={isPhone}
            onPick={pickPreset}
          />
          {isPhone ? null : (
            <Tooltip title={labels.close}>
              <IconButton
                size="medium"
                aria-label={labels.close}
                onClick={onClose}
                sx={{ ml: 'auto' }}
              >
                <Icon icon={Cross} size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {isPhone ? (
          <Box sx={{ px: '16px', pb: '16px' }}>
            {startField}
            <FieldError id={startErrorId} text={startError} />
            {endField}
            <FieldError id={endErrorId} text={endError} />
            <Box sx={{ display: 'flex', pt: '16px' }}>{buttons}</Box>
          </Box>
        ) : (
          <>
            <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />
            <Box sx={{ pt: '24px', px: '32px', overflowY: 'auto' }}>
              <MonthsCalendar
                months={2}
                displayMonth={displayMonth}
                onDisplayMonthChange={setDisplayMonth}
                start={start}
                end={end}
                min={min}
                max={max}
                today={today}
                onPick={pick}
                locale={locale}
                previousMonthLabel={labels.previousMonth}
                nextMonthLabel={labels.nextMonth}
              />
            </Box>
            <Box sx={{ pt: '24px', px: '32px' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
                {startField}
                <Box
                  aria-hidden="true"
                  sx={{
                    height: 48,
                    px: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'text.icon'
                  }}
                >
                  <Icon icon={Next} size={16} />
                </Box>
                {endField}
              </Box>
              {errors}
            </Box>
            <Box sx={{ display: 'flex', py: '16px', px: '32px', mt: '8px' }}>
              {buttons}
            </Box>
          </>
        )}
      </Box>
      {isPhone ? (
        <Dialog
          open={phonePicker !== null}
          onClose={() => {
            setPhonePicker(null)
          }}
          aria-labelledby={sheetTitleId}
          slotProps={{
            paper: {
              sx: {
                m: 0,
                mt: 'auto',
                width: '100%',
                maxWidth: '100%',
                borderRadius: SHEET_RADIUS,
                p: 1
              }
            }
          }}
        >
          <Box
            sx={{
              position: 'relative',
              height: 52,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Typography
              id={sheetTitleId}
              component="h2"
              variant="h4"
              color="text.primary"
            >
              {phonePicker === 'end' ? labels.end : labels.start}
            </Typography>
            <Tooltip title={labels.close}>
              <IconButton
                aria-label={labels.close}
                onClick={() => {
                  setPhonePicker(null)
                }}
                sx={{ position: 'absolute', right: 0 }}
              >
                <Icon icon={Cross} size={24} />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ p: '8px' }}>
            <MonthsCalendar
              months={1}
              displayMonth={displayMonth}
              onDisplayMonthChange={setDisplayMonth}
              start={phonePickedDay}
              end={phonePickedDay}
              min={min}
              max={max}
              today={today}
              onPick={day => {
                setPresetIndex(null)
                if (phonePicker === 'end') onEndTextChange(formatDayText(day))
                else onStartTextChange(formatDayText(day))
                setPhonePicker(null)
              }}
              locale={locale}
              previousMonthLabel={labels.previousMonth}
              nextMonthLabel={labels.nextMonth}
            />
          </Box>
        </Dialog>
      ) : null}
    </Dialog>
  )
}

interface PresetRowProps {
  presets: readonly DateRangePreset[]
  selected: number | null
  isPhone: boolean
  onPick: (index: number) => void
}

function PresetRow({
  presets,
  selected,
  isPhone,
  onPick
}: PresetRowProps): ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: '4px',
        p: isPhone ? '16px' : 0,
        overflowX: 'auto',
        flexShrink: isPhone ? 0 : 1,
        minWidth: 0
      }}
    >
      {presets.map((preset, index) => (
        <Chip
          key={preset.label}
          square
          clickable
          label={preset.label}
          aria-pressed={index === selected}
          onClick={() => {
            onPick(index)
          }}
          sx={PRESET_SX(index === selected)}
        />
      ))}
    </Box>
  )
}

interface DateFieldProps {
  id: string
  label: string
  hint: string
  value: string
  onChange: (text: string) => void
  hasError: boolean
  describedBy: string | undefined
  inputRef: Ref<HTMLInputElement> | undefined
  isAutoFocus: boolean
  /** The whole width (a phone), else its share of the row */
  isWide: boolean
  /** The calendar button inside the field, null for none */
  pickLabel: string | null
  onPick: () => void
  'data-testid'?: string
}

function DateField({
  id,
  label,
  hint,
  value,
  onChange,
  hasError,
  describedBy,
  inputRef,
  isAutoFocus,
  isWide,
  pickLabel,
  onPick,
  'data-testid': testId
}: DateFieldProps): ReactElement {
  return (
    <Box
      sx={
        isWide ? { width: '100%', pt: '8px' } : { flex: '1 1 0', minWidth: 0 }
      }
    >
      <Typography
        component="label"
        id={`${id}-label`}
        htmlFor={id}
        variant="body2"
        color="text.primary"
        sx={{ display: 'block', mb: 1 }}
      >
        {label}
      </Typography>
      <TextField
        id={id}
        fullWidth
        size="small"
        error={hasError}
        value={value}
        onChange={event => {
          onChange(event.target.value)
        }}
        placeholder={hint}
        autoFocus={isAutoFocus}
        inputRef={inputRef}
        slotProps={{
          input: {
            endAdornment:
              pickLabel === null ? undefined : (
                <Tooltip title={pickLabel}>
                  <IconButton
                    size="small"
                    aria-label={pickLabel}
                    aria-describedby={`${id}-label`}
                    onClick={onPick}
                  >
                    <Icon icon={Calendar} size={24} />
                  </IconButton>
                </Tooltip>
              )
          },
          htmlInput: {
            inputMode: 'numeric',
            autoComplete: 'off',
            maxLength: 10,
            'aria-invalid': hasError,
            'aria-describedby': describedBy,
            'data-testid': testId
          }
        }}
      />
    </Box>
  )
}

interface FieldErrorProps {
  id: string
  text: string | null
}

function FieldError({ id, text }: FieldErrorProps): ReactElement | null {
  if (text === null) return null
  return (
    <Typography
      id={id}
      component="p"
      variant="body2"
      color="error"
      sx={{ mt: 1 }}
    >
      {text}
    </Typography>
  )
}

interface PickerButtonProps {
  children: ReactNode
  isMain: boolean
  isWide: boolean
  type?: 'button' | 'submit'
  onClick?: () => void
  'data-testid'?: string
}

function PickerButton({
  children,
  isMain,
  isWide,
  type = 'button',
  onClick,
  'data-testid': testId
}: PickerButtonProps): ReactElement {
  return (
    <Button
      type={type}
      variant={isMain ? 'contained' : 'outlined'}
      onClick={onClick}
      sx={{
        flex: isWide ? '1 1 0' : '0 0 auto',
        minWidth: isWide ? undefined : 128,
        whiteSpace: 'nowrap'
      }}
      data-testid={testId}
    >
      {children}
    </Button>
  )
}
