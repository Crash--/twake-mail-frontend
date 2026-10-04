import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'
import { reportRenderError } from '@common/app/sentry'

import { RouteErrorScreen } from './RouteErrorScreen'

jest.mock('@common/app/sentry', () => ({ reportRenderError: jest.fn() }))

const failure = new Error('Broken page')
function Page(): ReactElement {
  throw failure
}

describe('RouteErrorScreen', () => {
  beforeEach(() => {
    // React logs the error caught by the router
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // Retrying navigates, which jsdom cannot run in a data router (its
  // AbortSignal is not the one of Node's Request)
  it('shows the crash screen of a page that fails and reports it', async () => {
    const router = createMemoryRouter([
      { path: '/', element: <Page />, errorElement: <RouteErrorScreen /> }
    ])
    render(
      <AppProviders lang="en" queryClient={makeQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>
    )

    expect(await screen.findByTestId('crash-error')).toBeVisible()
    expect(reportRenderError).toHaveBeenCalledWith(failure, '')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
  })
})
