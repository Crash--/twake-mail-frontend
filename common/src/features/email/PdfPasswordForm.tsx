import { Button, Paper, TextField, Typography } from '@linagora/twake-mui'
import { useId, useState, type ReactElement, type SubmitEvent } from 'react'

import { useI18n } from '@common/i18n/useI18n'

export interface PdfPasswordFormProps {
  /** The last password was wrong */
  isRetry: boolean
  onSubmit: (password: string) => void
}

/**
 * Asks the password of an encrypted PDF. The password goes to pdf.js only:
 * it is neither kept nor logged.
 */
export function PdfPasswordForm({
  isRetry,
  onSubmit
}: PdfPasswordFormProps): ReactElement {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const titleId = useId()

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault()
    onSubmit(password)
  }

  return (
    <Paper className="u-p-2">
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby={titleId}
        data-testid="pdf-password-form"
      >
        <Typography id={titleId} variant="h6" component="h2">
          {t('email.preview.passwordProtected')}
        </Typography>
        <TextField
          className="u-mv-1"
          type="password"
          label={t('email.preview.password')}
          autoComplete="off"
          autoFocus
          fullWidth
          value={password}
          onChange={event => {
            setPassword(event.target.value)
          }}
          error={isRetry}
          helperText={isRetry ? t('email.preview.wrongPassword') : undefined}
          slotProps={{
            htmlInput: { 'data-testid': 'pdf-password-input' }
          }}
        />
        <Button type="submit" variant="contained" fullWidth>
          {t('email.preview.openPdf')}
        </Button>
      </form>
    </Paper>
  )
}
