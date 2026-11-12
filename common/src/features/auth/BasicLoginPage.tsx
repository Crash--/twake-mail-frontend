import { Icon, Eye, EyeClosed } from '@linagora/twake-icons'
import { IconButton, Link, Tooltip } from '@linagora/twake-mui'
import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type SubmitEvent,
  type ReactElement
} from 'react'
import { Navigate, useLocation } from 'react-router'

import { LoginButton } from '@/ds/LoginButton/LoginButton'
import { LoginFormFrame } from '@/ds/LoginFormFrame/LoginFormFrame'
import { LoginLayout } from '@/ds/LoginLayout/LoginLayout'
import { LoginTextField } from '@/ds/LoginTextField/LoginTextField'
import { useDocumentTitle } from '@common/app/DocumentTitleProvider'
import { FullPageLoader } from '@common/components/FullPageLoader'
import { useAppConfig } from '@common/config/AppConfigProvider'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'
import { AppTitle } from '@injected/layout/AppTitle'

import { useAuthService, useAuthState } from './AuthProvider'
import type { LoginReason } from './RequireAuth'
import { sanitizeReturnTo } from './returnTo'
import type { BasicAuthService, BasicLoginError } from './types'

const LOGIN_ERROR_MESSAGES: Record<BasicLoginError, TranslationKey> = {
  'invalid-credentials': 'login.badCredentials',
  'network-error': 'login.connectionError',
  'unexpected-response': 'common.unknownError'
}

// The pictures of tmail-flutter's sign-in page, served by the app
const LOGIN_ASSETS = '/assets/images/login'

/** The privacy policy tmail-flutter links to from its login page */
const PRIVACY_POLICY_URL =
  'https://github.com/linagora/tmail-flutter/blob/master/privacy.md'

function findReturnTo(state: unknown): string {
  return sanitizeReturnTo(
    typeof state === 'object' && state !== null && 'returnTo' in state
      ? state.returnTo
      : '/'
  )
}

function findReason(state: unknown): LoginReason | null {
  return typeof state === 'object' &&
    state !== null &&
    'reason' in state &&
    state.reason === 'session-missing'
    ? 'session-missing'
    : null
}

/** What is wrong with the email field, before anything is sent */
type UsernameError = 'required' | 'no-domain'

const USERNAME_ERROR_MESSAGES: Record<UsernameError, TranslationKey> = {
  required: 'login.requiredEmail',
  'no-domain': 'login.emailNoDomain'
}

function findUsernameError(
  username: string,
  allowUsername: boolean
): UsernameError | null {
  const trimmed = username.trim()
  if (trimmed === '') return 'required'
  if (!allowUsername && !trimmed.includes('@')) return 'no-domain'
  return null
}

/**
 * `/login`: the email and password form of the basic authentication mode,
 * laid out as tmail-flutter's web sign-in page.
 */
export function BasicLoginPage(): ReactElement {
  const service = useAuthService()
  const state = useAuthState()
  const location = useLocation()

  if (service.mode !== 'basic') return <Navigate to="/" replace />

  if (state.status === 'authenticated') {
    return <Navigate to={findReturnTo(location.state)} replace />
  }

  // Another tab may hand its session over
  if (state.status === 'restoring') return <FullPageLoader />

  return (
    <BasicLoginForm service={service} reason={findReason(location.state)} />
  )
}

interface FieldErrors {
  username: UsernameError | null
  password: boolean
}

const NO_FIELD_ERRORS: FieldErrors = { username: null, password: false }

function BasicLoginForm({
  service,
  reason
}: {
  service: BasicAuthService
  reason: LoginReason | null
}): ReactElement {
  const { t } = useI18n()
  useDocumentTitle(t('login.title'))
  const titleId = useId()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(NO_FIELD_ERRORS)
  const [loginError, setLoginError] = useState<BasicLoginError | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const config = useAppConfig()
  const allowUsername = config?.loginAllowUsername ?? false

  const handleUsernameChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setUsername(event.target.value)
  }

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setPassword(event.target.value)
  }

  const submit = async (): Promise<void> => {
    const errors: FieldErrors = {
      username: findUsernameError(username, allowUsername),
      password: password === ''
    }
    setFieldErrors(errors)
    if (errors.username === 'no-domain') usernameRef.current?.focus()
    if (errors.username !== null || errors.password) return

    setIsSubmitting(true)
    setLoginError(null)
    const result = await service.login(username, password)
    // On success the page re-renders as signed in and navigates away
    if (!result.ok) {
      setIsSubmitting(false)
      setLoginError(result.error)
      // The submit button, disabled meanwhile, lost the focus: put it where
      // the user corrects the credentials
      passwordRef.current?.focus()
      passwordRef.current?.select()
    }
  }

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault()
    void submit()
  }

  const asset = (name: string): string =>
    new URL(`${LOGIN_ASSETS}/${name}`, window.location.origin).href
  const passwordToggleLabel = t(
    isPasswordShown ? 'login.hidePassword' : 'login.showPassword'
  )
  const privacyPolicyLabel = t('login.privacyPolicy')

  return (
    <LoginLayout
      pitchTitle={t('login.pitch.title')}
      pitchPoints={[
        { iconSrc: asset('ic_jmap_standard.svg'), text: t('login.pitch.jmap') },
        {
          iconSrc: asset('ic_encrypted.svg'),
          text: t('login.pitch.encrypted')
        },
        { iconSrc: asset('ic_team.svg'), text: t('login.pitch.team') },
        {
          iconSrc: asset('ic_integration.svg'),
          text: t('login.pitch.integrations')
        }
      ]}
      pitchImageSrc={asset('ic_login_graphic.svg')}
      footerImageSrc={asset('power_by_linagora.svg')}
      footerLabel={t('login.poweredBy')}
    >
      <LoginFormFrame
        logo={<AppTitle />}
        title={t('login.title')}
        titleId={titleId}
        message={
          loginError === null
            ? t(
                reason === 'session-missing'
                  ? 'login.sessionMissing'
                  : 'login.subtitle'
              )
            : t(LOGIN_ERROR_MESSAGES[loginError])
        }
        isError={loginError !== null}
        version={config === null ? null : `v.${config.appVersion}`}
        onSubmit={handleSubmit}
        button={
          <LoginButton
            disabled={isSubmitting}
            data-testid="login-submit-button"
          >
            {t('login.submit')}
          </LoginButton>
        }
        footer={
          <Link
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${privacyPolicyLabel} (${t('common.opensInNewTab')})`}
            data-testid="login-privacy-policy-link"
          >
            {privacyPolicyLabel}
          </Link>
        }
        data-testid="login-form"
        data-error-testid="login-error"
      >
        <LoginTextField
          label={t('login.email')}
          value={username}
          onChange={handleUsernameChange}
          autoComplete="username"
          inputMode="email"
          autoFocus
          required
          errorText={
            fieldErrors.username === null
              ? null
              : t(USERNAME_ERROR_MESSAGES[fieldErrors.username])
          }
          inputRef={usernameRef}
          data-testid="login-username-input"
        />
        <LoginTextField
          label={t('login.password')}
          type={isPasswordShown ? 'text' : 'password'}
          value={password}
          onChange={handlePasswordChange}
          autoComplete="current-password"
          required
          errorText={fieldErrors.password ? t('login.requiredPassword') : null}
          inputRef={passwordRef}
          endAdornment={
            <Tooltip title={passwordToggleLabel}>
              <IconButton
                aria-label={passwordToggleLabel}
                aria-pressed={isPasswordShown}
                edge="end"
                onClick={() => {
                  setIsPasswordShown(shown => !shown)
                }}
                data-testid="login-password-toggle"
              >
                <Icon icon={isPasswordShown ? EyeClosed : Eye} size={20} />
              </IconButton>
            </Tooltip>
          }
          data-testid="login-password-input"
        />
      </LoginFormFrame>
    </LoginLayout>
  )
}
