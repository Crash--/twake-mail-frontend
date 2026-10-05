import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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

  it('has a title that expands and collapses the section when it can toggle', async () => {
    const onToggle = jest.fn()
    renderDs(
      <NavSectionHeader
        title="Folders"
        titleId="folders-title"
        toggle={{
          isExpanded: true,
          onToggle,
          controlsId: 'folders-content'
        }}
      />
    )

    const button = screen.getByRole('button', { name: 'Folders' })
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveAttribute('aria-controls', 'folders-content')
    expect(
      screen.getByRole('heading', { level: 2, name: 'Folders' })
    ).toContainElement(button)

    await userEvent.click(button)

    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
