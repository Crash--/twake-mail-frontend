import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { MessageHeader } from './MessageHeader'

describe('MessageHeader', () => {
  it('lays out the avatar, the identity and the date', () => {
    renderDs(
      <MessageHeader
        avatar={<span>AM</span>}
        identity={<p>Alice Martin</p>}
        date={<time dateTime="2026-10-04">Oct 4</time>}
      />
    )

    const identity = screen.getByText('Alice Martin').parentElement
    expect(screen.getByText('AM')).toBeVisible()
    expect(screen.getByText('Oct 4')).toBeVisible()
    expect(identity).toHaveStyle({ gridArea: 'identity' })
    expect(getComputedStyle(identity?.parentElement as Element).display).toBe(
      'grid'
    )
  })
})
