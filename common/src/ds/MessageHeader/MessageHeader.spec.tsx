import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { MessageHeader } from './MessageHeader'

describe('MessageHeader', () => {
  it('lays out the avatar, the identity and the actions', () => {
    renderDs(
      <MessageHeader
        avatar={<span>AM</span>}
        identity={<p>Alice Martin</p>}
        actions={<button type="button">Star</button>}
      />
    )

    const identity = screen.getByText('Alice Martin').parentElement
    expect(screen.getByText('AM')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Star' })).toBeVisible()
    expect(identity).toHaveStyle({ gridArea: 'identity' })
    expect(getComputedStyle(identity?.parentElement as Element).display).toBe(
      'grid'
    )
  })
})
