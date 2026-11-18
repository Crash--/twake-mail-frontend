import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import {
  ROW_AVATAR_SIZE,
  RowSender,
  SENDER_BLOCK_WIDTH,
  SENDER_WIDTH
} from './RowSender'

describe('RowSender', () => {
  it('puts the avatar, the name and the trailing content in order', () => {
    const { container } = renderDs(
      <RowSender
        avatar={<b>Avatar</b>}
        trailing={<u>(3)</u>}
        data-testid="name"
      >
        Alice
      </RowSender>
    )

    expect(container).toHaveTextContent('AvatarAlice(3)')
    expect(screen.getByTestId('name')).toHaveTextContent('Alice')
  })

  it('keeps a 172 px name block, then 32 px before the subject', () => {
    expect(SENDER_BLOCK_WIDTH).toBe(172)
    expect(SENDER_WIDTH).toBe(ROW_AVATAR_SIZE + 8 + 172 + 32)
  })
})
