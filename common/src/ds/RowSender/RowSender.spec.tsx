import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { RowSender } from './RowSender'

describe('RowSender', () => {
  it('puts the marker, the avatar, the name and the trailing content in order', () => {
    const { container } = renderDs(
      <RowSender
        marker={<i>Dot</i>}
        avatar={<b>Avatar</b>}
        trailing={<u>(3)</u>}
        data-testid="name"
      >
        Alice
      </RowSender>
    )

    expect(container).toHaveTextContent('DotAvatarAlice(3)')
    expect(screen.getByTestId('name')).toHaveTextContent('Alice')
  })
})
