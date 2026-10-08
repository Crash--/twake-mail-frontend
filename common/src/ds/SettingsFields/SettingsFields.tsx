// Upstream to twake-ui: no, the fields of tmail-flutter's settings: an
// outlined field 48 px high (40 in a form row) with a radius of 10, a light
// grey border, the text in Regular 14 black and the hint in steel grey; a
// label in Semi Bold 14 dark grey with a grey pill after it ("Forward to
// [2 recipients]"); a form row with its label on the left in Regular 14
// grey, in a column of fixed width.
import { Box, TextField, Typography } from '@linagora/twake-mui'
import {
  useId,
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
  type Ref
} from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

function fieldSx(
  height: number,
  width: number | string
): Record<string, unknown> {
  return {
    width,
    maxWidth: '100%',
    '& .MuiOutlinedInput-root': {
      height,
      borderRadius: '10px',
      bgcolor: '#FFFFFF',
      fontSize: 14,
      lineHeight: '20px',
      color: '#000000',
      '& fieldset': { borderColor: '#E3E5E8' },
      '&:hover fieldset': { borderColor: '#C6CBD1' },
      '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 1 },
      '&.Mui-error fieldset': { borderColor: 'error.main' },
      '&.Mui-disabled': { bgcolor: '#FFFFFF', opacity: 0.6 }
    },
    '& .MuiOutlinedInput-input': {
      px: '12px',
      '&::placeholder': { color: '#818C99', opacity: 1 }
    },
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
  fontSize: 14,
  lineHeight: '20px',
  color: 'rgba(66, 66, 68, 0.64)'
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

const LABEL_SX = {
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 600,
  letterSpacing: '0.25px',
  color: '#424244'
} as const

const PILL_SX = {
  ml: 2,
  px: '12px',
  py: '4px',
  borderRadius: '16px',
  bgcolor: 'rgba(73, 69, 79, 0.08)',
  fontSize: 14,
  lineHeight: '18px',
  color: '#000000'
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
    <Typography component="p" sx={{ ...LABEL_SX, mt: 2, mb: 2 }}>
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
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 400,
  color: 'rgba(66, 66, 68, 0.64)'
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
  children: ReactNode
}

/** The label of a field of a settings form row */
export function SettingsFormRowLabel({
  htmlFor,
  children
}: SettingsFormRowLabelProps): ReactElement {
  return (
    <Box component="label" htmlFor={htmlFor} sx={ROW_LABEL_SX}>
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

export interface SettingsFormRowProps {
  /** The visible label, e.g. "Start date:" */
  label: string
  /** Id of the field it labels */
  htmlFor?: string
  /** The label at the top, beside a tall field */
  alignTop?: boolean
  children: ReactNode
}

/** A row of a settings form: its label on the left, its fields after it */
export function SettingsFormRow({
  label,
  htmlFor,
  alignTop = false,
  children
}: SettingsFormRowProps): ReactElement {
  return (
    <Box sx={alignTop ? { ...ROW_SX, alignItems: 'flex-start' } : ROW_SX}>
      <SettingsFormRowLabel htmlFor={htmlFor}>{label}</SettingsFormRowLabel>
      {children}
    </Box>
  )
}
