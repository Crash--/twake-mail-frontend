import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { TopActionBar } from './TopActionBar'

describe('TopActionBar', () => {
  it('has its start first, then its actions, in a 56 px bar', () => {
    renderDs(
      <TopActionBar
        start={<button type="button">Close</button>}
        data-testid="bar"
      >
        <button type="button">Attach</button>
        <button type="button">Send</button>
      </TopActionBar>
    )

    expect(
      screen.getAllByRole('button').map(button => button.textContent)
    ).toEqual(['Close', 'Attach', 'Send'])
    expect(getComputedStyle(screen.getByTestId('bar')).minHeight).toBe('56px')
  })
})
