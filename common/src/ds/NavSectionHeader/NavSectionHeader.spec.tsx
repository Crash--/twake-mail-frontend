import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { NavSectionHeader } from './NavSectionHeader'

describe('NavSectionHeader', () => {
  it('is a level 2 heading, followed by its actions', () => {
    renderDs(
      <NavSectionHeader
        title="Folders"
        titleId="folders-title"
        actions={<button type="button">Add</button>}
      />
    )

    expect(
      screen.getByRole('heading', { level: 2, name: 'Folders' })
    ).toHaveAttribute('id', 'folders-title')
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })
})
