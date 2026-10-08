import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Pen } from '@/ds/FlutterIcons/FlutterIcons'
import { renderDs } from '@/ds/testing/renderDs'

import { FloatingActionButton } from './FloatingActionButton'

describe('FloatingActionButton', () => {
  it('is a labelled button fixed at the bottom of the screen', async () => {
    const onClick = jest.fn()
    renderDs(
      <FloatingActionButton
        label="New message"
        icon={Pen}
        onClick={onClick}
        data-testid="fab"
      />
    )

    const button = screen.getByRole('button', { name: 'New message' })
    expect(button).toHaveTextContent('New message')
    expect(button).toBe(screen.getByTestId('fab'))
    expect(getComputedStyle(button).position).toBe('fixed')
    // Darker than twake-mui's primary.dark (#006bd8), 4.1:1 on its background
    expect(getComputedStyle(button).color).toBe('rgb(0, 90, 183)')

    await userEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
