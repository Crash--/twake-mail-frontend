import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { makeEmail, makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import {
  makeFakeBasicAuthService,
  makeFakeOidcAuthService
} from '@common/testing/makeFakeAuthService'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { AppRoutes } from './AppRoutes'

const ANONYMOUS = { status: 'anonymous' } as const

describe('AppRoutes', () => {
  it('opens the inbox of a signed-in user', async () => {
    renderWithProviders(<AppRoutes apps={[]} />, { route: '/' })

    expect(await screen.findByTestId('mailbox-page')).toHaveAttribute(
      'data-mailbox-id',
      'mailbox-inbox'
    )
    expect(screen.getByTestId('top-bar')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
  })

  it('opens the inbox instead of a mailbox of another account', async () => {
    renderWithProviders(<AppRoutes apps={[]} />, {
      route: '/mailbox/not-mine'
    })

    await waitFor(() => {
      expect(screen.getByTestId('mailbox-page')).toHaveAttribute(
        'data-mailbox-id',
        'mailbox-inbox'
      )
    })
  })

  it('opens an email of a mailbox', async () => {
    renderWithProviders(<AppRoutes apps={[]} />, {
      route: '/mailbox/mailbox-inbox/email/e1',
      jmapServer: makeFakeJmapServer({
        emails: [makeEmail({ id: 'e1', subject: 'Hello Alice' })]
      })
    })

    expect(await screen.findByTestId('email-view-subject')).toHaveTextContent(
      'Hello Alice'
    )
  })

  it('sends a signed-out user to the login form in basic mode', () => {
    renderWithProviders(<AppRoutes apps={[]} />, {
      route: '/mailbox/m1',
      authService: makeFakeBasicAuthService(ANONYMOUS)
    })

    expect(screen.queryByTestId('login-form')).toBeInTheDocument()
    expect(screen.queryByTestId('mailbox-page')).toBe(null)
  })

  it('sends a signed-out user to the SSO in OIDC mode', () => {
    const authService = makeFakeOidcAuthService(ANONYMOUS)
    renderWithProviders(<AppRoutes apps={[]} />, {
      route: '/mailbox/m1?page=2',
      authService
    })

    expect(authService.startLogin).toHaveBeenCalledWith('/mailbox/m1?page=2')
    expect(screen.queryByTestId('full-page-loader')).toBeInTheDocument()
  })

  it('lets the user retry when the SSO is unreachable', async () => {
    const authService = makeFakeOidcAuthService(ANONYMOUS)
    authService.startLogin = jest.fn(() =>
      Promise.resolve({ ok: false as const, error: 'timeout' })
    )
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    renderWithProviders(<AppRoutes apps={[]} />, { authService })

    await userEvent.click(await screen.findByTestId('sso-error-action'))

    expect(authService.startLogin).toHaveBeenCalledTimes(2)
  })

  it('lands on the page asked for once the SSO calls back', async () => {
    const authService = makeFakeOidcAuthService(ANONYMOUS)
    authService.handleCallback = jest.fn(() => {
      authService.store.setState({
        status: 'authenticated',
        user: { email: 'alice@example.com', name: null }
      })
      return Promise.resolve({
        ok: true as const,
        value: { returnTo: '/mailbox/mailbox-sent' }
      })
    })
    renderWithProviders(<AppRoutes apps={[]} />, {
      route: '/callback?code=abc&state=xyz',
      authService
    })

    expect(
      await screen.findByRole('treeitem', { current: 'page' })
    ).toHaveAttribute('data-mailbox-id', 'mailbox-sent')
    expect(screen.getByTestId('mailbox-page')).toHaveAttribute(
      'data-mailbox-id',
      'mailbox-sent'
    )
    expect(authService.handleCallback).toHaveBeenCalledTimes(1)
  })

  it('offers to reconnect when the callback fails', async () => {
    const authService = makeFakeOidcAuthService(ANONYMOUS)
    authService.handleCallback = jest.fn(() =>
      Promise.resolve({
        ok: false as const,
        error: 'token-exchange-failed' as const
      })
    )
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    renderWithProviders(<AppRoutes apps={[]} />, {
      route: '/callback?code=abc',
      authService
    })

    expect(
      await screen.findByTestId('callback-error-action')
    ).toHaveTextContent('Reconnect')
  })
})
