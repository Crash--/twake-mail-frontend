import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { CollapsibleCategory } from './CollapsibleCategory'

describe('CollapsibleCategory', () => {
  it('is a heading whose button folds the list it titles', async () => {
    const onToggle = jest.fn()
    const { rerender } = renderDs(
      <CollapsibleCategory
        title="Personal folders"
        isExpanded
        onToggle={onToggle}
        controlsId="personal"
        isList
      >
        <li>Work</li>
      </CollapsibleCategory>
    )

    const toggle = screen.getByRole('button', { name: 'Personal folders' })
    expect(
      screen.getByRole('heading', { name: 'Personal folders' })
    ).toContainElement(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('list', { name: 'Personal folders' })
    ).toHaveTextContent('Work')
    await userEvent.click(toggle)
    expect(onToggle).toHaveBeenCalledTimes(1)

    rerender(
      <CollapsibleCategory
        title="Personal folders"
        isExpanded={false}
        onToggle={onToggle}
        controlsId="personal"
        isList
      >
        <li>Work</li>
      </CollapsibleCategory>
    )
    expect(screen.queryByText('Work')).toBe(null)
  })
})
