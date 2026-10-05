import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'

import { makeFakeBasicAuthService } from '@common/testing/makeFakeAuthService'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { BasicLoginPage } from './BasicLoginPage'

function renderLoginPage(
  service = makeFakeBasicAuthService({ status: 'anonymous' })
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(<BasicLoginPage />, {
    route: { pathname: '/login', state: { returnTo: '/mailbox/42' } },
    path: '/login',
    authService: service,
    routes: <Route path="/mailbox/:mailboxId" element={<p>Mailbox page</p>} />
  })
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
    service.login = jest.fn(() =>
      Promise.resolve({
        ok: false as const,
        error: 'invalid-credentials' as const
      })
    )
    renderLoginPage(service)

    await userEvent.type(
      screen.getByTestId('login-username-input'),
      'alice@example.com'
    )
    await userEvent.type(screen.getByTestId('login-password-input'), 'wrong')
    await userEvent.click(screen.getByTestId('login-submit-button'))

    expect(await screen.findByTestId('login-error')).toHaveTextContent(
      'Bad credentials'
    )
    expect(screen.getByTestId('login-submit-button')).toBeEnabled()
    expect(screen.queryByText('Mailbox page')).toBe(null)
  })

  it('shows a connection error when the server is unreachable', async () => {
    const service = makeFakeBasicAuthService({ status: 'anonymous' })
    service.login = jest.fn(() =>
      Promise.resolve({ ok: false as const, error: 'network-error' as const })
    )
    renderLoginPage(service)

    await userEvent.type(screen.getByTestId('login-username-input'), 'alice')
    await userEvent.type(screen.getByTestId('login-password-input'), 'secret')
    await userEvent.click(screen.getByTestId('login-submit-button'))

    expect(await screen.findByTestId('login-error')).toHaveTextContent(
      'Connection error'
    )
  })
})
