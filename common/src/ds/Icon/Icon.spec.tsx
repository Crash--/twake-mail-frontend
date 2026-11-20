import { Star } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { Icon } from './Icon'

describe('Icon', () => {
  it('hides an unlabelled icon from assistive technologies', () => {
    renderDs(<Icon icon={Star} data-testid="icon" />)

    const icon = screen.getByTestId('icon')
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    expect(icon.getAttribute('focusable')).toBe('false')
    expect(screen.queryByRole('img')).toBe(null)
  })

  it('renders a labelled icon as an image named by its label', () => {
    renderDs(<Icon icon={Star} role="img" aria-label="Starred" />)

    const icon = screen.getByRole('img', { name: 'Starred' })
    expect(icon.getAttribute('aria-hidden')).toBe(null)
  })

  it('keeps the size it is given', () => {
    renderDs(<Icon icon={Star} size={12} data-testid="icon" />)

    expect(screen.getByTestId('icon').getAttribute('width')).toBe('12')
  })
})
