// Upstream to twake-ui: no. The sign-in button: twake-mui's large `Button`,
// the width of the form.
import { Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

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
      size="large"
      fullWidth
      disabled={disabled}
      data-testid={testId}
    >
      {children}
    </Button>
  )
}
