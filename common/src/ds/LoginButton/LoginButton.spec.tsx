import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { LoginButton } from './LoginButton'

describe('LoginButton', () => {
  it('submits the form it is in', () => {
    renderDs(<LoginButton disabled>Sign In</LoginButton>)

    const button = screen.getByRole('button', { name: 'Sign In' })
    expect(button).toHaveAttribute('type', 'submit')
    expect(button).toBeDisabled()
  })
})
