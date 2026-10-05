import { Send } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { PillButton } from './PillButton'

describe('PillButton', () => {
  it('is a named button that calls back on click', async () => {
    const onClick = jest.fn()
    renderDs(<PillButton label="Send" icon={Send} onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('can be disabled', () => {
    renderDs(
      <PillButton label="Send" icon={Send} onClick={jest.fn()} disabled />
    )
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })
})
