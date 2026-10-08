import { fireEvent, screen } from '@testing-library/react'

import { Star } from '@/ds/FlutterIcons/FlutterIcons'
import { renderDs } from '@/ds/testing/renderDs'

import { IconAction } from './IconAction'

describe('IconAction', () => {
  it('is a button named by its label', () => {
    const onClick = jest.fn()
    renderDs(
      <IconAction
        label="Star"
        icon={Star}
        onClick={onClick}
        aria-pressed={false}
        data-testid="action"
      />
    )

    const button = screen.getByRole('button', { name: 'Star' })
    expect(button).toBe(screen.getByTestId('action'))
    expect(button).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
