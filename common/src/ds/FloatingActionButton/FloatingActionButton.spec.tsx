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
    // tmail-flutter's: white on its blue (#208BFF)
    expect(getComputedStyle(button).color).toBe('rgb(255, 255, 255)')

    await userEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
