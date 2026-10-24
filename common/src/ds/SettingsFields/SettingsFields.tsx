// Upstream to twake-ui: no. The fields of the settings: twake-mui's outlined
// `TextField`, 48 px high (40 in a form row); a label with a pill after it
// ("Forward to [2 recipients]"); a form row with its label on the left, in a
// column of fixed width.
import { Box, MenuItem, TextField, Typography } from '@linagora/twake-mui'
import {
  useId,
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
  type Ref
} from 'react'

import { SCREEN_QUERIES, useScreenSize } from '@/ds/useScreenSize/useScreenSize'

function fieldSx(
  height: number,
  width: number | string
): Record<string, unknown> {
  return {
    width,
    maxWidth: '100%',
    '& .MuiOutlinedInput-root': { height },
    '& .MuiOutlinedInput-input': { px: '12px' },
    '& .MuiFormHelperText-root': { mx: 0 }
  }
}

export interface SettingsTextFieldProps {
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  /** Its hint, shown while it is empty */
  placeholder?: string
  /** Its accessible name: the field shows no label */
  label: string
  inputRef?: Ref<HTMLInputElement>
  error?: boolean
  /** Under the field, e.g. the error */
  helperText?: string
  /** Id of an element describing the field elsewhere, e.g. its error */
  describedBy?: string
  disabled?: boolean
  required?: boolean
  /** `form`: 40 px high, in a `SettingsFormRow` */
  size?: 'large' | 'form'
  width?: number | string
  type?: string
  inputMode?: 'email' | 'text'
  inputTestId?: string
  /** Of the input, for the `htmlFor` of a `SettingsFormRow` */
  id?: string
  className?: string
  'data-testid'?: string
}

/** A text field of the settings */
export function SettingsTextField({
  value,
  onChange,
  placeholder,
  label,
  inputRef,
  error = false,
  helperText,
  describedBy,
  disabled = false,
  required = false,
  size = 'large',
  width = 404,
  type,
  inputMode,
  inputTestId,
  id,
  className,
  'data-testid': testId
}: SettingsTextFieldProps): ReactElement {
  return (
    <TextField
      inputRef={inputRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      error={error}
      helperText={helperText}
      disabled={disabled}
      required={required}
      type={type}
      id={id}
      className={className}
      sx={fieldSx(size === 'form' ? 40 : 48, width)}
      slotProps={{
        htmlInput: {
          'aria-label': label,
          ...(describedBy === undefined
            ? {}
            : { 'aria-describedby': describedBy }),
          inputMode,
          'data-testid': inputTestId
        }
      }}
      data-testid={testId}
    />
  )
}

const SELECT_LABEL_SX = {
  display: 'block',
  mb: '12px',
  typography: 'body1',
  color: 'text.secondary'
} as const

export interface SettingsSelectProps {
  /** Shown above the field, and its name */
  label: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  /** The `option` elements */
  children: ReactNode
  width?: number
  inputTestId?: string
}

/** A native select of the settings, its label above it */
export function SettingsSelect({
  label,
  value,
  onChange,
  children,
  width = 384,
  inputTestId
}: SettingsSelectProps): ReactElement {
  const id = useId()
  return (
    <Box>
      <Box component="label" htmlFor={id} sx={SELECT_LABEL_SX}>
        {label}
      </Box>
      <TextField
        select
        id={id}
        value={value}
        onChange={onChange}
        sx={fieldSx(40, width)}
        slotProps={{
          select: { native: true },
          htmlInput: { 'data-testid': inputTestId }
        }}
      >
        {children}
      </TextField>
    </Box>
  )
}

/** The menu of the language picker, under its field */
const MENU_PAPER_SX = { mt: '4px' } as const

/** A primary check after the one picked */
const CHECK_SX = {
  ml: 'auto',
  flexShrink: 0,
  display: 'flex',
  color: 'primary.main'
} as const

function CheckedIcon(): ReactElement {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="12" fill="currentColor" />
      <path
        d="M6.5 12.5L10 16L17.5 8.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export interface SettingsMenuSelectOption {
  value: string
  /** In the menu, e.g. "French - Français" */
  label: string
  /** Shown in the field once picked, e.g. "French" */
  shortLabel: string
  /** Language of the label, for screen readers */
  lang?: string
}

export interface SettingsMenuSelectProps {
  /** Shown above the field, and its name */
  label: string
  value: string
  options: readonly SettingsMenuSelectOption[]
  onChange: (value: string) => void
  width?: number
  /** On the button opening the menu */
  inputTestId?: string
}

/**
 * A picker of the settings as tmail-flutter's language one: the field shows
 * the value picked, its menu lists every value with a check after the
 * picked one (a combobox and its listbox)
 */
export function SettingsMenuSelect({
  label,
  value,
  options,
  onChange,
  width = 385,
  inputTestId
}: SettingsMenuSelectProps): ReactElement {
  const labelId = useId()
  return (
    <Box>
      <Box id={labelId} sx={{ ...SELECT_LABEL_SX, mb: '15px' }}>
        {label}
      </Box>
      <TextField
        select
        value={value}
        onChange={event => {
          onChange(event.target.value)
        }}
        sx={fieldSx(40, width)}
        slotProps={{
          select: {
            labelId,
            renderValue: selected =>
              options.find(option => option.value === selected)?.shortLabel ??
              '',
            SelectDisplayProps: { 'data-testid': inputTestId } as Record<
              string,
              string | undefined
            >,
            MenuProps: {
              slotProps: { paper: { sx: { ...MENU_PAPER_SX, width } } }
            }
          }
        }}
      >
        {options.map(option => (
          <MenuItem key={option.value} value={option.value} lang={option.lang}>
            {option.label}
            {option.value === value ? (
              <Box component="span" sx={CHECK_SX}>
                <CheckedIcon />
              </Box>
            ) : null}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  )
}

const LABEL_SX = { typography: 'subtitle2', color: 'text.primary' } as const

const PILL_SX = {
  ml: 2,
  px: '12px',
  py: '4px',
  borderRadius: '16px',
  bgcolor: 'action.hover',
  typography: 'body1',
  color: 'text.primary'
} as const

export interface SettingsLabelPillProps {
  label: string
  /** In the grey pill after the label */
  pill: string
  /** The label is a heading of the section */
  component?: 'h2' | 'p'
  id?: string
}

/** A label of the settings and a value in a grey pill after it */
export function SettingsLabelPill({
  label,
  pill,
  component = 'p',
  id
}: SettingsLabelPillProps): ReactElement {
  return (
    <Box className="u-flex u-flex-items-center" sx={{ pt: '20px', pb: '36px' }}>
      <Typography id={id} component={component} sx={{ ...LABEL_SX, m: 0 }}>
        {label}
      </Typography>
      <Box component="span" sx={PILL_SX}>
        {pill}
      </Box>
    </Box>
  )
}

export interface SettingsCountProps {
  label: string
  count: number
}

/** A label of the settings and a number after it ("Name of Rules 2") */
export function SettingsCount({
  label,
  count
}: SettingsCountProps): ReactElement {
  return (
    // As tmail-flutter (`CountNameOfRulesWidget`): the list follows right
    // after it
    <Typography component="p" sx={{ ...LABEL_SX, mt: 2, mb: 0 }}>
      {label}{' '}
      <Box component="span" sx={{ fontWeight: 400 }}>
        {count}
      </Box>
    </Typography>
  )
}

const COLUMN_SX = { maxWidth: 660 } as const

const ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 2,
  mb: '12px',
  [`@media ${SCREEN_QUERIES.mobile}`]: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 1
  }
} as const

const ROW_LABEL_SX = {
  flex: '0 0 auto',
  minWidth: 79,
  typography: 'body1',
  color: 'text.secondary'
} as const

const FIELD_SX = {
  flex: '1 1 0',
  minWidth: 0,
  maxWidth: '100%',
  // A wide toolbar inside is cut, not the page scrolled; the focus ring
  // around the field stays in view
  overflowX: 'clip',
  overflowClipMargin: '4px',
  [`@media ${SCREEN_QUERIES.mobile}`]: { flex: 'none', width: '100%' }
} as const

export interface SettingsFormColumnProps {
  children: ReactNode
}

/** The column of a settings form, 660 px wide at most */
export function SettingsFormColumn({
  children
}: SettingsFormColumnProps): ReactElement {
  return <Box sx={COLUMN_SX}>{children}</Box>
}

export interface SettingsFormRowLabelProps {
  /** Id of the field it labels */
  htmlFor?: string
  /** Faded with its field */
  isDisabled?: boolean
  children: ReactNode
}

/** The label of a field of a settings form row */
export function SettingsFormRowLabel({
  htmlFor,
  isDisabled = false,
  children
}: SettingsFormRowLabelProps): ReactElement {
  return (
    <Box
      component="label"
      htmlFor={htmlFor}
      sx={
        isDisabled ? { ...ROW_LABEL_SX, color: 'text.disabled' } : ROW_LABEL_SX
      }
    >
      {children}
    </Box>
  )
}

export interface SettingsFormFieldProps {
  children: ReactNode
}

/** A field taking the room left in a settings form row */
export function SettingsFormField({
  children
}: SettingsFormFieldProps): ReactElement {
  return <Box sx={FIELD_SX}>{children}</Box>
}

export interface SettingsFormPairPart {
  label: string
  htmlFor: string
  field: ReactNode
}

export interface SettingsFormPairProps {
  first: SettingsFormPairPart
  second: SettingsFormPairPart
  /** Its fields are disabled: the labels fade */
  isDisabled?: boolean
}

const PAIR_SX = { display: 'flex', gap: 2, mb: '12px' } as const

const PAIR_PART_SX = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  minWidth: 0
} as const

/**
 * Two labelled fields of a settings form row ("Start date", "Start time"):
 * in the row on a desktop and a tablet; side by side, each label above its
 * field, on a phone, as tmail-flutter
 */
export function SettingsFormPair({
  first,
  second,
  isDisabled = false
}: SettingsFormPairProps): ReactElement {
  const isPhone = useScreenSize() === 'mobile'
  if (!isPhone) {
    return (
      <SettingsFormRow
        label={first.label}
        htmlFor={first.htmlFor}
        isDisabled={isDisabled}
      >
        {first.field}
        <SettingsFormRowLabel htmlFor={second.htmlFor} isDisabled={isDisabled}>
          {second.label}
        </SettingsFormRowLabel>
        {second.field}
      </SettingsFormRow>
    )
  }
  return (
    <Box sx={PAIR_SX}>
      {[first, second].map(part => (
        <Box key={part.htmlFor} sx={PAIR_PART_SX}>
          <SettingsFormRowLabel htmlFor={part.htmlFor} isDisabled={isDisabled}>
            {part.label}
          </SettingsFormRowLabel>
          {part.field}
        </Box>
      ))}
    </Box>
  )
}

export interface SettingsFormRowProps {
  /** The visible label, e.g. "Start date:" */
  label: string
  /** Id of the field it labels */
  htmlFor?: string
  /** The label at the top, beside a tall field */
  alignTop?: boolean
  /** Its fields are disabled: the label fades */
  isDisabled?: boolean
  children: ReactNode
}

/** A row of a settings form: its label on the left, its fields after it */
export function SettingsFormRow({
  label,
  htmlFor,
  alignTop = false,
  isDisabled = false,
  children
}: SettingsFormRowProps): ReactElement {
  return (
    <Box sx={alignTop ? { ...ROW_SX, alignItems: 'flex-start' } : ROW_SX}>
      <SettingsFormRowLabel htmlFor={htmlFor} isDisabled={isDisabled}>
        {label}
      </SettingsFormRowLabel>
      {children}
    </Box>
  )
}

export interface SettingsFieldSlotProps {
  /** As wide as a large `SettingsTextField` (404 px), or the whole row */
  isFullWidth?: boolean
  className?: string
  children: ReactNode
}

/**
 * Room for a field of another kind (e.g. a `RecipientField`) on a row of
 * the settings, as wide as their text fields; it grows with what it holds,
 * never wider than the row
 */
export function SettingsFieldSlot({
  isFullWidth = false,
  className,
  children
}: SettingsFieldSlotProps): ReactElement {
  return (
    <Box
      className={className}
      sx={{ width: isFullWidth ? '100%' : 404, maxWidth: '100%', minWidth: 0 }}
    >
      {children}
    </Box>
  )
}
