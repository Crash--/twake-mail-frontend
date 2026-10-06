import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { ActionBar, ActionBarButton } from './ActionBar'

describe('ActionBar', () => {
  it('is a named group of buttons, each running its action', async () => {
    const onReply = jest.fn()
    renderDs(
      <ActionBar label="Reply actions">
        <ActionBarButton icon={<span aria-hidden="true" />} onClick={onReply}>
          Reply
        </ActionBarButton>
        <ActionBarButton icon={<span aria-hidden="true" />} onClick={jest.fn()}>
          Forward
        </ActionBarButton>
      </ActionBar>
    )

    const group = screen.getByRole('group', { name: 'Reply actions' })
    expect(group).toBeVisible()
    expect(screen.getAllByRole('button')).toHaveLength(2)

    await userEvent.click(screen.getByRole('button', { name: 'Reply' }))

    expect(onReply).toHaveBeenCalledTimes(1)
  })
})
