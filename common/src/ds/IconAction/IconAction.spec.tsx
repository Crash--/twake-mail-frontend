import { Star } from '@linagora/twake-icons'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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

  it('keeps its tooltip off the way of the controls around it', async () => {
    const onNext = jest.fn()
    renderDs(
      <>
        <IconAction label="Starred" icon={Star} />
        <button type="button" onClick={onNext}>
          Select
        </button>
      </>
    )

    await userEvent.hover(screen.getByRole('button', { name: 'Starred' }))
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent('Starred')
    expect(tooltip).not.toHaveClass('MuiTooltip-popperInteractive')
    await userEvent.click(screen.getByRole('button', { name: 'Select' }))
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
