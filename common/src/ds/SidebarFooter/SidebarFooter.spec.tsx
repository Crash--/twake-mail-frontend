import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { SidebarFooter } from './SidebarFooter'

describe('SidebarFooter', () => {
  it('holds its children and the version', () => {
    renderDs(
      <SidebarFooter
        version="version 1.2.3"
        versionTestId="version"
        data-testid="footer"
      >
        <p>Storage</p>
      </SidebarFooter>
    )

    expect(screen.getByTestId('footer')).toHaveTextContent('Storage')
    expect(screen.getByTestId('version')).toHaveTextContent('version 1.2.3')
  })

  it('shows no version line without one', () => {
    renderDs(<SidebarFooter data-testid="footer">Storage</SidebarFooter>)

    expect(screen.getByTestId('footer')).toHaveTextContent('Storage')
    expect(screen.getByTestId('footer').querySelector('p')).toBeNull()
  })
})
