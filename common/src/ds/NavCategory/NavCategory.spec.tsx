import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { DefaultFolderIcon } from '@/ds/FolderIcons/FolderIcons'
import { renderDs } from '@/ds/testing/renderDs'

import { NavCategory } from './NavCategory'

function Harness(): ReactElement {
  const [isExpanded, setIsExpanded] = useState(true)
  return (
    <NavCategory
      title="Personal folders"
      titleId="title"
      icon={DefaultFolderIcon}
      isExpanded={isExpanded}
      onToggle={() => {
        setIsExpanded(expanded => !expanded)
      }}
      controlsId="content"
    >
      <p>Projects</p>
    </NavCategory>
  )
}

describe('NavCategory', () => {
  it('expands and collapses what it holds, saying so', async () => {
    renderDs(<Harness />)

    const toggle = screen.getByRole('button', { name: 'Personal folders' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Projects')).toBeVisible()

    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Projects')).not.toBeVisible()
  })
})
