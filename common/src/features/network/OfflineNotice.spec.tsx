import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import { OfflineNotice } from './OfflineNotice'

function setOnline(isOnline: boolean): void {
  jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(isOnline)
  act(() => {
    window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'))
  })
}

describe('OfflineNotice', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it('shows nothing while online', () => {
    renderWithProviders(<OfflineNotice />)

    expect(screen.queryByTestId('offline-banner')).toBe(null)
    expect(screen.getByTestId('network-announcement')).toBeEmptyDOMElement()
  })

  it('shows the banner and says it once when the browser goes offline', () => {
    renderWithProviders(<OfflineNotice />)

    setOnline(false)

    expect(screen.getByTestId('offline-banner')).toHaveTextContent(
      'No internet connection'
    )
    // The banner is not a second live region
    expect(
      within(screen.getByTestId('offline-banner')).queryByRole('alert')
    ).toBe(null)
    expect(screen.getByTestId('offline-banner')).not.toHaveAttribute(
      'role',
      'alert'
    )
    expect(screen.getAllByTestId('network-announcement')).toHaveLength(1)
    expect(screen.getByTestId('network-announcement')).toHaveTextContent(
      'No internet connection'
    )
  })

  it('shows the banner at once when the page opens offline', () => {
    jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)

    renderWithProviders(<OfflineNotice />)

    expect(screen.getByTestId('offline-banner')).toBeInTheDocument()
  })

  it('removes the banner and says "Back online" when the network returns', () => {
    jest.useFakeTimers()
    renderWithProviders(<OfflineNotice />)
    setOnline(false)

    setOnline(true)

    expect(screen.queryByTestId('offline-banner')).toBe(null)
    expect(screen.getByTestId('network-announcement')).toHaveTextContent(
      'Back online'
    )

    act(() => {
      jest.advanceTimersByTime(6_000)
    })
    expect(screen.getByTestId('network-announcement')).toBeEmptyDOMElement()
  })

  it('hides the banner for the session with Dismiss, and says nothing more', async () => {
    renderWithProviders(<OfflineNotice />)
    setOnline(false)

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByTestId('offline-banner')).toBe(null)
    expect(screen.getByTestId('network-announcement')).toBeEmptyDOMElement()

    setOnline(true)
    expect(screen.getByTestId('network-announcement')).toBeEmptyDOMElement()
  })
})
