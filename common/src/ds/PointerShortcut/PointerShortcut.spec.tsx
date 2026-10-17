import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { PointerShortcut } from './PointerShortcut'

describe('PointerShortcut', () => {
  it('runs its action on a click', async () => {
    const onClick = jest.fn()
    renderDs(
      <PointerShortcut onClick={onClick} data-testid="shortcut">
        A
      </PointerShortcut>
    )

    await userEvent.click(screen.getByTestId('shortcut'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('adds no tab stop and nothing for assistive technologies', async () => {
    renderDs(
      <>
        <PointerShortcut onClick={jest.fn()} data-testid="shortcut">
          A
        </PointerShortcut>
        <button type="button">Next</button>
      </>
    )

    await userEvent.tab()

    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'A' })).toBe(null)
    expect(screen.getByTestId('shortcut')).toHaveAttribute('tabindex', '-1')
  })

  it('keeps the focus where it was on a click', () => {
    renderDs(
      <PointerShortcut onClick={jest.fn()} data-testid="shortcut">
        A
      </PointerShortcut>
    )

    const isDefault = fireEvent.mouseDown(screen.getByTestId('shortcut'))

    expect(isDefault).toBe(false)
  })
})
