import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { CategoryTabs } from './CategoryTabs'

const TABS = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' }
]

function Harness(): ReactElement {
  const [value, setValue] = useState('one')
  return (
    <CategoryTabs tabs={TABS} value={value} onChange={setValue} label="Kinds">
      <p>{`Panel ${value}`}</p>
    </CategoryTabs>
  )
}

describe('CategoryTabs', () => {
  it('shows the panel of the selected tab, named by it', async () => {
    renderDs(<Harness />)

    expect(screen.getByRole('tablist', { name: 'Kinds' })).toBeVisible()
    expect(screen.getByRole('tabpanel', { name: 'One' })).toHaveTextContent(
      'Panel one'
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Two' }))

    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('tabpanel', { name: 'Two' })).toHaveTextContent(
      'Panel two'
    )
  })
})
