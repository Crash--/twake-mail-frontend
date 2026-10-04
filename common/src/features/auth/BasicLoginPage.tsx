import {
  Alert,
  Button,
  Stack,
  TextField,
  Typography
} from '@linagora/twake-mui'
import {
  useId,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactElement
} from 'react'
import { Navigate, useLocation } from 'react-router'

import { CenteredCard } from '@/ds/CenteredCard/CenteredCard'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useDocumentTitle } from '@common/app/useDocumentTitle'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'
import { AppTitle } from '@injected/layout/AppTitle'

import { useAuthService, useAuthState } from './AuthProvider'
import { sanitizeReturnTo } from './returnTo'
import type { BasicAuthService, BasicLoginError } from './types'

const LOGIN_ERROR_MESSAGES: Record<BasicLoginError, TranslationKey> = {
  'invalid-credentials': 'login.badCredentials',
  'network-error': 'login.connectionError',
  'unexpected-response': 'common.unknownError'
}

function findReturnTo(state: unknown): string {
  return sanitizeReturnTo(
    typeof state === 'object' && state !== null && 'returnTo' in state
      ? state.returnTo
      : '/'
  )
}

/**
 * `/login`: the email and password form of the basic authentication mode.
 */
export function BasicLoginPage(): ReactElement {
  const service = useAuthService()
  const state = useAuthState()
  const location = useLocation()

  if (service.mode !== 'basic') return <Navigate to="/" replace />

  if (state.status === 'authenticated') {
    return <Navigate to={findReturnTo(location.state)} replace />
  }

  return <BasicLoginForm service={service} />
}

interface FieldErrors {
  username: boolean
  password: boolean
}

const NO_FIELD_ERRORS: FieldErrors = { username: false, password: false }

function BasicLoginForm({
  service
}: {
  service: BasicAuthService
}): ReactElement {
  const { t } = useI18n()
  useDocumentTitle(t('login.title'))
  const titleId = useId()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(NO_FIELD_ERRORS)
  const [loginError, setLoginError] = useState<BasicLoginError | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleUsernameChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setUsername(event.target.value)
  }

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setPassword(event.target.value)
  }

  const submit = async (): Promise<void> => {
    const errors: FieldErrors = {
      username: username.trim() === '',
      password: password === ''
    }
    setFieldErrors(errors)
    if (errors.username || errors.password) return

    setIsSubmitting(true)
    setLoginError(null)
    const result = await service.login(username, password)
    // On success the page re-renders as signed in and navigates away
    if (!result.ok) {
      setIsSubmitting(false)
      setLoginError(result.error)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    void submit()
  }

  return (
    <CenteredCard>
      <Stack
        component="form"
        spacing={2}
        noValidate
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
        data-testid="login-form"
      >
        <AppTitle />
        <div>
          <Typography variant="h4" component="h1" id={titleId}>
            {t('login.title')}
          </Typography>
          <SecondaryText variant="body2" component="p">
            {t('login.subtitle')}
          </SecondaryText>
        </div>
        {loginError !== null ? (
          <Alert severity="error" data-testid="login-error">
            {t(LOGIN_ERROR_MESSAGES[loginError])}
          </Alert>
        ) : null}
        <TextField
          label={t('login.email')}
          value={username}
          onChange={handleUsernameChange}
          autoComplete="username"
          required
          fullWidth
          error={fieldErrors.username}
          helperText={fieldErrors.username ? t('login.requiredEmail') : null}
          slotProps={{
            htmlInput: {
              inputMode: 'email',
              'data-testid': 'login-username-input'
            }
          }}
        />
        <TextField
          label={t('login.password')}
          type="password"
          value={password}
          onChange={handlePasswordChange}
          autoComplete="current-password"
          required
          fullWidth
          error={fieldErrors.password}
          helperText={fieldErrors.password ? t('login.requiredPassword') : null}
          slotProps={{
            htmlInput: { 'data-testid': 'login-password-input' }
          }}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={isSubmitting}
          data-testid="login-submit-button"
        >
          {t('login.submit')}
        </Button>
      </Stack>
    </CenteredCard>
  )
}
