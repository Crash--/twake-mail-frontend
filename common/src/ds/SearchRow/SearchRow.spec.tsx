import { screen } from '@testing-library/react'
import { createRef } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { SearchRow } from './SearchRow'

describe('SearchRow', () => {
  it('shows the search, then the actions', () => {
    renderDs(
      <SearchRow
        search={<input aria-label="Search mail" />}
        actions={<button type="button">Settings</button>}
        data-testid="search-row"
      />
    )

    const search = screen.getByRole('textbox', { name: 'Search mail' })
    const settings = screen.getByRole('button', { name: 'Settings' })
    expect(search).toBeVisible()
    expect(
      search.compareDocumentPosition(settings) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(screen.getByTestId('search-row')).toBeVisible()
  })

  it('gives access to the box around the search', () => {
    const searchRef = createRef<HTMLDivElement>()

    renderDs(
      <SearchRow
        search={<input aria-label="Search mail" />}
        searchRef={searchRef}
      />
    )

    expect(searchRef.current?.querySelector('input')).not.toBe(null)
  })
})
