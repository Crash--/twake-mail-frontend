import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { RecipientSummary } from './RecipientSummary'

const CHIPS = ['Alice', 'Bob', 'Carol', 'Dave'].map(label => ({
  id: label,
  label,
  isInvalid: label === 'Carol'
}))

describe('RecipientSummary', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('is a button named by its label and every name, unfolding on click', async () => {
    const onExpand = jest.fn()
    renderDs(
      <RecipientSummary
        chips={CHIPS}
        label="Show all the recipients:"
        moreLabel={count => `+${String(count)}`}
        onExpand={onExpand}
      />
    )

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Show all the recipients: Alice, Bob, Carol, Dave'
      })
    )
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it('counts the recipients that do not fit', () => {
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300)
    jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100)
    renderDs(
      <RecipientSummary
        chips={CHIPS}
        label="Show all the recipients:"
        moreLabel={count => `+${String(count)}`}
        onExpand={jest.fn()}
      />
    )

    expect(screen.getByText('+2')).toBeInTheDocument()
  })
})
