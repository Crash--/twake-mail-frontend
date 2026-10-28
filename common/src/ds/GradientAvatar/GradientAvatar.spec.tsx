import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { firstLetterOf, GradientAvatar } from './GradientAvatar'

describe('GradientAvatar', () => {
  it('keeps the first letter of a name, upper case', () => {
    expect(firstLetterOf('  alice')).toBe('A')
    expect(firstLetterOf('')).toBe('')
  })

  it('draws the letter on the gradient, hidden from assistive technologies', () => {
    renderDs(<GradientAvatar text="A" colorKey="a" data-testid="avatar" />)

    const avatar = screen.getByTestId('avatar')
    expect(avatar).toHaveTextContent('A')
    expect(avatar).toHaveAttribute('aria-hidden', 'true')
  })
})
