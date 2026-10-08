import { Star } from '@linagora/twake-icons'
import { fireEvent, screen } from '@testing-library/react'

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

  it('draws the icon at the size asked, in the secondary text colour for the quiet tone', () => {
    renderDs(
      <IconAction
        label="Delete"
        icon={Star}
        iconSize={16}
        tone="secondary"
        data-testid="action"
      />
    )

    const button = screen.getByTestId('action')
    expect(button.querySelector('svg')).toHaveAttribute('width', '16')
    expect(button).toHaveStyle({ width: '32px', height: '32px' })
  })
})
