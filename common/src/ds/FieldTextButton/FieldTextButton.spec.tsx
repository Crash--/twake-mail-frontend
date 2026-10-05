import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { FieldTextButton } from './FieldTextButton'

describe('FieldTextButton', () => {
  it('is a button that calls back on click', async () => {
    const onClick = jest.fn()
    renderDs(<FieldTextButton onClick={onClick}>CC</FieldTextButton>)
    await userEvent.click(screen.getByRole('button', { name: 'CC' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
