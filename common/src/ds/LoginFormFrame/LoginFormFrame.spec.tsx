import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { LoginFormFrame } from './LoginFormFrame'

describe('LoginFormFrame', () => {
  it('is a form named by its heading, the message an alert when it is an error', () => {
    renderDs(
      <LoginFormFrame
        logo={<span>Logo</span>}
        title="Sign In"
        titleId="title"
        message="Bad credentials"
        isError
        button={<button type="submit">Go</button>}
        version="v.1.0"
        onSubmit={jest.fn()}
        data-error-testid="error"
      >
        <input aria-label="Email" />
      </LoginFormFrame>
    )

    expect(screen.getByRole('form', { name: 'Sign In' })).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Sign In' })
    ).toBeVisible()
    expect(screen.getByRole('alert')).toBe(screen.getByTestId('error'))
    expect(screen.getByText('v.1.0')).toBeVisible()
  })

  it('shows the footer under the button', () => {
    renderDs(
      <LoginFormFrame
        logo={<span>Logo</span>}
        title="Sign In"
        titleId="title"
        message="Sign in to continue"
        button={<button type="submit">Go</button>}
        footer={<a href="https://example.com/privacy">Privacy policy</a>}
        onSubmit={jest.fn()}
      >
        <input aria-label="Email" />
      </LoginFormFrame>
    )

    const button = screen.getByRole('button', { name: 'Go' })
    const link = screen.getByRole('link', { name: 'Privacy policy' })
    expect(
      button.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})
