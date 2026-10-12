// Upstream to twake-ui: no, the look of tmail-flutter's sign-in button
// (`buildLoginButton`): 48 px high, the width of the form, a 10 px radius,
// blue (#007AFF), its label in 16 px white.
import { Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

const BUTTON_SX = {
  height: 48,
  borderRadius: '10px',
  bgcolor: '#007AFF',
  boxShadow: 'none',
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: 500,
  textTransform: 'none',
  '&:hover': { bgcolor: '#0067D6', boxShadow: 'none' }
} as const

export interface LoginButtonProps {
  children: string
  disabled?: boolean
  'data-testid'?: string
}

/** The submit button of the sign-in form */
export function LoginButton({
  children,
  disabled = false,
  'data-testid': testId
}: LoginButtonProps): ReactElement {
  return (
    <Button
      type="submit"
      variant="contained"
      fullWidth
      disabled={disabled}
      sx={BUTTON_SX}
      data-testid={testId}
    >
      {children}
    </Button>
  )
}
