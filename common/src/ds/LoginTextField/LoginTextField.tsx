// Upstream to twake-ui: no. The sign-in fields: the name shown above the
// field, kept while typing (RGAA 11.1, WCAG 3.3.2), the box of tmail-flutter,
// a primary border with the focus, an error one in error. No placeholder: the
// name is never repeated. twake-mui's `PasswordField` is not used: it shows
// its own visibility button.
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
  borderRadius: 1,
  border: '1px solid',
  borderColor: 'border.main',
  bgcolor: 'background.paper',
  typography: 'body1',
  color: 'text.primary',
  '&.Mui-focused': {
    border: '2px solid',
    borderColor: 'primary.main',
    px: '26px'
  },
  '& .MuiIconButton-root': { color: 'text.icon' },
  '&.Mui-error': { borderColor: 'error.main' }
} as const

const LABEL_SX = {
  display: 'block',
  mb: 0.5,
  typography: 'body2',
  color: 'text.secondary',
  overflowWrap: 'anywhere'
} as const

const ERROR_SX = { mx: '24px' } as const

export interface LoginTextFieldProps {
  /** The name of the field, shown above it */
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
      <Box component="label" htmlFor={id} sx={LABEL_SX}>
        {label}
      </Box>
      <InputBase
        id={id}
        value={value}
        onChange={onChange}
        type={type}
        autoComplete={autoComplete}
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
