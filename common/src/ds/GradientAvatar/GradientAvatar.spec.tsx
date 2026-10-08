import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { firstLetterOf, GradientAvatar, gradientOf } from './GradientAvatar'

describe('GradientAvatar', () => {
  it('picks the gradient of tmail-flutter from the sum of the code units of the key', () => {
    // "a" is 97: the eighth gradient
    expect(gradientOf('a')).toEqual(['#EFC0D7', '#1AD5E4'])
    expect(gradientOf('')).toEqual(['#21D4FD', '#B721FF'])
  })

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
