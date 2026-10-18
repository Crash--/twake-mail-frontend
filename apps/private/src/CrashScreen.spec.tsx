import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import { CrashScreen } from './CrashScreen'

function Page({ isBroken }: { isBroken: boolean }): ReactElement {
  if (isBroken) throw new Error('Broken page')
  return <p>The page</p>
}

function App(): ReactElement {
  const [isBroken, setIsBroken] = useState(true)
  return (
    <ErrorBoundary
      FallbackComponent={CrashScreen}
      onReset={() => {
        setIsBroken(false)
      }}
    >
      <Page isBroken={isBroken} />
    </ErrorBoundary>
  )
}

describe('CrashScreen', () => {
  beforeEach(() => {
    // React logs the error caught by the boundary
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('is the whole page: its main landmark, under a level-1 title', () => {
    renderWithProviders(<App />)

    expect(screen.getByTestId('crash-error')).toBeVisible()
    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', {
        level: 1,
        name: 'Error! An error occurred. Please try again later.'
      })
    )
  })

  it('renders the app again on Retry', async () => {
    renderWithProviders(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(screen.getByText('The page')).toBeVisible()
    expect(screen.queryByTestId('crash-error')).toBe(null)
  })
})
