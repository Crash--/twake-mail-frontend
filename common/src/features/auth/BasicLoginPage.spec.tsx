import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'

import { resolveConfig, type AppConfig } from '@common/config/config'
import { makeFakeBasicAuthService } from '@common/testing/makeFakeAuthService'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { BasicLoginPage } from './BasicLoginPage'
import type { LoginRouteState } from './RequireAuth'

interface RenderOptions {
  routeState?: LoginRouteState
  config?: AppConfig
}

function renderLoginPage(
  service = makeFakeBasicAuthService({ status: 'anonymous' }),
  { routeState = { returnTo: '/mailbox/42' }, config }: RenderOptions = {}
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(<BasicLoginPage />, {
    route: { pathname: '/login', state: routeState },
    path: '/login',
    authService: service,
    config,
    routes: <Route path="/mailbox/:mailboxId" element={<p>Mailbox page</p>} />
  })
}

function makeConfig(loginAllowUsername: boolean): AppConfig {
  const result = resolveConfig(
    {
      SERVER_URL: 'https://jmap.example.com',
      AUTH_MODE: 'basic',
      LOGIN_ALLOW_USERNAME: loginAllowUsername
    },
    'https://mail.example.com',
    () => undefined
  )
  if (!result.ok) throw new Error(result.errors.join(', '))
  return result.value
}

function rejectingLogin(): jest.Mock {
  return jest.fn(() =>
    Promise.resolve({
      ok: false as const,
      error: 'invalid-credentials' as const
    })
  )
}

describe('BasicLoginPage', () => {
  it('shows the email and password fields', () => {
    renderLoginPage()

    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeVisible()
    expect(screen.getByLabelText(/Email/)).toBe(
      screen.getByTestId('login-username-input')
    )
    expect(screen.getByLabelText(/Password/)).toBe(
      screen.getByTestId('login-password-input')
    )
    expect(screen.getByTestId('login-password-input')).toHaveAttribute(
      'type',
      'password'
    )
    expect(screen.getByText('Email')).toBeVisible()
    expect(screen.getByText('Password')).toBeVisible()
    expect(screen.getByTestId('login-username-input')).not.toHaveAttribute(
      'placeholder'
    )
    expect(screen.getByTestId('login-form')).toHaveTextContent(
      'Enter your credentials to sign in'
    )
  })

  it('says why the form is back after a lost session', () => {
    renderLoginPage(undefined, {
      routeState: { returnTo: '/mailbox/42', reason: 'session-missing' }
    })

    expect(
      screen.getByText(
        'For your security, Twake Mail does not keep your password after a reload. Sign in again to continue.'
      )
    ).toBeVisible()
    expect(screen.queryByTestId('login-error')).toBe(null)
  })

  it('asks for the domain of an email without calling the server', async () => {
    const service = makeFakeBasicAuthService({ status: 'anonymous' })
    renderLoginPage(service)
    const usernameInput = screen.getByTestId('login-username-input')

    await userEvent.type(usernameInput, 'bob')
    await userEvent.type(screen.getByTestId('login-password-input'), 'bob')
    await userEvent.keyboard('{Enter}')

    expect(service.login).not.toHaveBeenCalled()
    expect(usernameInput).toHaveAttribute('aria-invalid', 'true')
    expect(usernameInput).toHaveAccessibleDescription(
      'Enter your full email address, including the part after @.'
    )
    expect(usernameInput).toHaveFocus()
  })

  it('sends a user name without domain with LOGIN_ALLOW_USERNAME', async () => {
    const service = makeFakeBasicAuthService({ status: 'anonymous' })
    service.login = rejectingLogin()
    renderLoginPage(service, { config: makeConfig(true) })

    await userEvent.type(screen.getByTestId('login-username-input'), 'bob')
    await userEvent.type(screen.getByTestId('login-password-input'), 'bob')
    await userEvent.click(screen.getByTestId('login-submit-button'))

    expect(service.login).toHaveBeenCalledWith('bob', 'bob')
  })

  it('shows and masks the password again with the toggle', async () => {
    renderLoginPage()
    const toggle = screen.getByTestId('login-password-toggle')
    const passwordInput = screen.getByTestId('login-password-input')

    expect(toggle).toHaveAccessibleName('Show password')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(toggle)

    expect(passwordInput).toHaveAttribute('type', 'text')
    expect(toggle).toHaveAccessibleName('Hide password')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(toggle)

    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(toggle).toHaveAccessibleName('Show password')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('links to the privacy policy in a new tab', () => {
    renderLoginPage()

    const link = screen.getByRole('link', {
      name: 'Privacy policy (opens in a new tab)'
    })
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/linagora/tmail-flutter/blob/master/privacy.md'
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('asks for the missing fields without calling the server', async () => {
    const service = makeFakeBasicAuthService({ status: 'anonymous' })
    renderLoginPage(service)

    await userEvent.click(screen.getByTestId('login-submit-button'))

    expect(screen.queryByText('Email is required')).toBeInTheDocument()
    expect(screen.queryByText('Password is required')).toBeInTheDocument()
    expect(service.login).not.toHaveBeenCalled()
  })

  it('signs in and goes back to the page asked for', async () => {
    const service = makeFakeBasicAuthService({ status: 'anonymous' })
    service.login = jest.fn(() => {
      service.store.setState({
        status: 'authenticated',
        user: { email: 'alice@example.com', name: null, workplaceFqdn: null }
      })
      return Promise.resolve({ ok: true as const })
    })
    renderLoginPage(service)

    await userEvent.type(
      screen.getByTestId('login-username-input'),
      'alice@example.com'
    )
    await userEvent.type(screen.getByTestId('login-password-input'), 'secret')
    await userEvent.click(screen.getByTestId('login-submit-button'))

    expect(service.login).toHaveBeenCalledWith('alice@example.com', 'secret')
    expect(await screen.findByText('Mailbox page')).toBeVisible()
  })

  it('shows an error when the server refuses the credentials', async () => {
    const service = makeFakeBasicAuthService({ status: 'anonymous' })
    service.login = rejectingLogin()
    renderLoginPage(service)

    await userEvent.type(
      screen.getByTestId('login-username-input'),
      'alice@example.com'
    )
    await userEvent.type(screen.getByTestId('login-password-input'), 'wrong')
    await userEvent.click(screen.getByTestId('login-submit-button'))

    expect(await screen.findByTestId('login-error')).toHaveTextContent(
      'Incorrect email address or password.'
    )
    expect(screen.getByTestId('login-submit-button')).toBeEnabled()
    expect(screen.queryByText('Mailbox page')).toBe(null)
  })

  it('puts the focus back on the password after a refused sign-in', async () => {
    const service = makeFakeBasicAuthService({ status: 'anonymous' })
    service.login = rejectingLogin()
    renderLoginPage(service)

    await userEvent.type(
      screen.getByTestId('login-username-input'),
      'alice@example.com'
    )
    await userEvent.type(screen.getByTestId('login-password-input'), 'wrong')
    await userEvent.click(screen.getByTestId('login-submit-button'))

    await screen.findByTestId('login-error')
    expect(screen.getByTestId('login-password-input')).toHaveFocus()
  })

  it('shows a connection error when the server is unreachable', async () => {
    const service = makeFakeBasicAuthService({ status: 'anonymous' })
    service.login = jest.fn(() =>
      Promise.resolve({ ok: false as const, error: 'network-error' as const })
    )
    renderLoginPage(service)

    await userEvent.type(
      screen.getByTestId('login-username-input'),
      'alice@example.com'
    )
    await userEvent.type(screen.getByTestId('login-password-input'), 'secret')
    await userEvent.click(screen.getByTestId('login-submit-button'))

    expect(await screen.findByTestId('login-error')).toHaveTextContent(
      'Connection error'
    )
  })

  it('waits for the session of another tab before showing the form', () => {
    const service = makeFakeBasicAuthService({ status: 'restoring' })
    renderLoginPage(service)

    expect(screen.getByTestId('full-page-loader')).toBeInTheDocument()
    expect(screen.queryByTestId('login-submit-button')).toBe(null)
  })
})
