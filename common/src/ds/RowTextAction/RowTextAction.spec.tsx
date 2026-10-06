import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { RowTextAction } from './RowTextAction'

describe('RowTextAction', () => {
  it('is named by its text and described by what it does', async () => {
    const onClick = jest.fn()
    renderDs(
      <RowTextAction description="Delete all spam emails" onClick={onClick}>
        Clean
      </RowTextAction>
    )

    const button = screen.getByRole('button', { name: 'Clean' })
    await userEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
    await userEvent.hover(button)
    expect(
      await screen.findByRole('tooltip', { name: 'Delete all spam emails' })
    ).toBeInTheDocument()
  })
})
