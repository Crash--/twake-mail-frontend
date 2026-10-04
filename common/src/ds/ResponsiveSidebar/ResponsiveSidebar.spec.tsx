import { screen } from '@testing-library/react'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { renderDs } from '@/ds/testing/renderDs'

import { ResponsiveSidebar } from './ResponsiveSidebar'

function renderSidebar(open: boolean): void {
  renderDs(
    <ResponsiveSidebar
      open={open}
      onClose={jest.fn()}
      label="Navigation"
      closeLabel="Close"
      drawerHeader={<span>Logo</span>}
      data-testid="sidebar"
      drawerTestId="drawer"
    >
      <a href="/inbox">Inbox</a>
    </ResponsiveSidebar>
  )
}

describe('ResponsiveSidebar', () => {
  afterEach(resetViewport)

  it('is a column always shown on a desktop', () => {
    mockViewport({ width: 1440 })

    renderSidebar(false)

    expect(screen.getByTestId('sidebar').tagName).toBe('ASIDE')
    expect(screen.getByRole('link', { name: 'Inbox' })).toBeVisible()
    expect(screen.queryByText('Logo')).toBe(null)
    expect(screen.queryByRole('dialog')).toBe(null)
  })

  it.each([390, 820, 1024])(
    'is a drawer, closed until asked, on a %i px screen',
    width => {
      mockViewport({ width })

      renderSidebar(false)

      expect(screen.queryByTestId('sidebar')).toBe(null)
      expect(screen.queryByRole('link', { name: 'Inbox' })).toBe(null)
    }
  )

  it('opens the drawer with its header below the desktop size', () => {
    mockViewport({ width: 390, touch: true })

    renderSidebar(true)

    const drawer = screen.getByRole('dialog', { name: 'Navigation' })
    expect(drawer).toBe(screen.getByTestId('drawer'))
    expect(screen.getByText('Logo')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Inbox' })).toBeVisible()
  })
})
