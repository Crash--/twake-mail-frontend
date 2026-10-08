import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { AiScribePopover } from './AiScribePopover'

describe('AiScribePopover', () => {
  it('holds the cards above its anchor, Escape closing them', async () => {
    const onClose = jest.fn()
    const anchor = document.createElement('button')
    document.body.append(anchor)
    renderDs(
      <AiScribePopover
        open
        anchorEl={anchor}
        onClose={onClose}
        label="AI assistant"
      >
        <button type="button">Inside</button>
      </AiScribePopover>
    )

    screen.getByRole('button', { name: 'Inside' }).focus()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    anchor.remove()
  })
})
