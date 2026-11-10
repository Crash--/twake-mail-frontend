import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { LoginTextField } from './LoginTextField'

describe('LoginTextField', () => {
  it('is named by its label, shown above it while typing', () => {
    renderDs(
      <LoginTextField
        label="Email"
        value="bob@example.com"
        onChange={jest.fn()}
        required
        data-testid="email"
      />
    )

    const input = screen.getByLabelText('Email')
    expect(input).toBe(screen.getByTestId('email'))
    expect(input).not.toHaveAttribute('placeholder')
    expect(screen.getByText('Email')).toBeVisible()
    expect(input).toBeRequired()
    expect(input).toHaveAttribute('aria-invalid', 'false')
  })

  it('says its error, and is invalid', () => {
    renderDs(
      <LoginTextField
        label="Email"
        value=""
        onChange={jest.fn()}
        errorText="Email is required"
      />
    )

    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Email is required')
  })
})
