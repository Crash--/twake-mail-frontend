import { FolderOutlined } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { NavTreeItem } from '@/ds/NavTreeItem/NavTreeItem'
import { renderDs } from '@/ds/testing/renderDs'

import { NavCategory } from './NavCategory'

function Harness(): ReactElement {
  const [isExpanded, setIsExpanded] = useState(true)
  return (
    <NavCategory
      title="Personal folders"
      titleId="title"
      icon={FolderOutlined}
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

  it('puts the rows it holds a level deeper, 16 px in, the background at full width', () => {
    renderDs(
      <NavCategory
        title="Personal folders"
        titleId="title"
        icon={FolderOutlined}
        isExpanded
        onToggle={jest.fn()}
        controlsId="content"
      >
        <ul>
          <NavTreeItem
            level={1}
            icon={null}
            label="Projects"
            linkComponent="a"
            to="/projects"
          />
        </ul>
      </NavCategory>
    )

    expect(window.getComputedStyle(screen.getByRole('listitem'))).toMatchObject(
      { marginLeft: '16px', paddingLeft: '16px' }
    )
  })
})
