import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { FilterAdvanced } from '@/ds/FlutterIcons/FlutterIcons'
import { renderDs } from '@/ds/testing/renderDs'

import { SearchBarAction } from './SearchBarAction'

describe('SearchBarAction', () => {
  it('is a named icon button, marked while it applies', async () => {
    const onClick = jest.fn()
    renderDs(
      <SearchBarAction
        label="Advanced search"
        icon={FilterAdvanced}
        isActive
        onClick={onClick}
        aria-haspopup="dialog"
      />
    )

    const button = screen.getByRole('button', { name: 'Advanced search' })
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    expect(button).toHaveAttribute('data-active', 'true')
    await userEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
