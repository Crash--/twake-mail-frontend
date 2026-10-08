import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { SelectableAvatar } from './SelectableAvatar'

function Harness(): ReactElement {
  const [checked, setChecked] = useState(false)
  return (
    <SelectableAvatar
      avatar={<i>A</i>}
      checked={checked}
      onClick={() => {
        setChecked(value => !value)
      }}
      label="Select Hi"
    />
  )
}

describe('SelectableAvatar', () => {
  it('is a checkbox named by its label, the avatar until checked', async () => {
    renderDs(<Harness />)

    const checkbox = screen.getByRole('checkbox', { name: 'Select Hi' })
    expect(checkbox).toHaveAttribute('aria-checked', 'false')
    expect(checkbox).toHaveTextContent('A')

    await userEvent.click(checkbox)

    expect(checkbox).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText('A')).toBe(null)
  })
})
