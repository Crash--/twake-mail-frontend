import { Pen } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { ComposeButton } from './ComposeButton'

describe('ComposeButton', () => {
  it('is a button named by its label, that calls onClick', async () => {
    const onClick = jest.fn()
    renderDs(<ComposeButton label="New message" icon={Pen} onClick={onClick} />)

    await userEvent.click(screen.getByRole('button', { name: 'New message' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
