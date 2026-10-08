// Upstream to twake-ui: no, the look of tmail-flutter's sign-in fields
// (`LoginInputDecorationBuilder`): filled light grey (#F2F3F5), a 10 px
// radius, 16 px text 25 px in, the name inside the field until something is
// typed, a 2 px blue border with the focus, a red one in error. The name
// stays the label of the input for assistive technologies.
import { Box, FormHelperText, InputBase } from '@linagora/twake-mui'
import {
  useId,
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
  type Ref
} from 'react'

const FIELD_SX = {
  width: '100%',
  height: 48,
  boxSizing: 'border-box',
  px: '27px',
  borderRadius: '10px',
  border: '1px solid #F2F3F5',
  bgcolor: '#F2F3F5',
  fontSize: 16,
  color: '#000000',
  '&.Mui-focused': { border: '2px solid #007AFF', px: '26px' },
  '& .MuiIconButton-root': { color: '#7E869B' },
  '&.Mui-error': { borderColor: '#E64646' },
  '& .MuiInputBase-input::placeholder': { color: '#7E869B', opacity: 1 }
} as const

const ERROR_SX = { mx: '24px' } as const

export interface LoginTextFieldProps {
  /** The name of the field, shown inside it while empty */
  label: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  type?: 'text' | 'password'
  autoComplete?: string
  inputMode?: 'email' | 'text'
  required?: boolean
  /** Shown under the field, and marks it invalid */
  errorText?: string | null
  /** After the text, e.g. a button showing the password */
  endAdornment?: ReactNode
  /** Takes the focus when the page opens, as tmail-flutter's email */
  autoFocus?: boolean
  inputRef?: Ref<HTMLInputElement>
  'data-testid'?: string
}

/** A text field of the sign-in form */
export function LoginTextField({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  inputMode,
  required = false,
  errorText = null,
  endAdornment,
  autoFocus = false,
  inputRef,
  'data-testid': testId
}: LoginTextFieldProps): ReactElement {
  const id = useId()
  const errorId = `${id}-error`
  const hasError = errorText !== null
  return (
    <Box className="u-w-100">
      <label htmlFor={id} className="u-visuallyhidden">
        {label}
      </label>
      <InputBase
        id={id}
        value={value}
        onChange={onChange}
        type={type}
        autoComplete={autoComplete}
        placeholder={label}
        required={required}
        error={hasError}
        endAdornment={endAdornment}
        autoFocus={autoFocus}
        inputRef={inputRef}
        sx={FIELD_SX}
        inputProps={{
          inputMode,
          'aria-invalid': hasError,
          'aria-describedby': hasError ? errorId : undefined,
          'data-testid': testId
        }}
      />
      {hasError ? (
        <FormHelperText id={errorId} error sx={ERROR_SX}>
          {errorText}
        </FormHelperText>
      ) : null}
    </Box>
  )
}
