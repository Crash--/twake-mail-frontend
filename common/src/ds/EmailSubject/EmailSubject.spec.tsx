import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { EmailSubject } from './EmailSubject'

describe('EmailSubject', () => {
  it('is the focusable first heading of the view', () => {
    renderDs(<EmailSubject data-testid="subject">Hello</EmailSubject>)

    const heading = screen.getByRole('heading', { level: 1, name: 'Hello' })
    expect(heading).toBe(screen.getByTestId('subject'))
    expect(heading).toHaveAttribute('tabindex', '-1')
  })
})
