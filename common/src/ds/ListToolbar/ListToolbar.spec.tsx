import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { ListToolbar } from './ListToolbar'

describe('ListToolbar', () => {
  it('is a region named by its label, holding its controls', () => {
    renderDs(
      <ListToolbar label="List actions">
        <button type="button">Refresh</button>
      </ListToolbar>
    )

    expect(
      screen.getByRole('region', { name: 'List actions' })
    ).toContainElement(screen.getByRole('button', { name: 'Refresh' }))
  })
})
