import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { SecondaryText } from './SecondaryText'

describe('SecondaryText', () => {
  it('cuts the text after the given number of lines', () => {
    renderDs(
      <SecondaryText lines={2} data-testid="text">
        A long preview
      </SecondaryText>
    )

    const style = getComputedStyle(screen.getByTestId('text'))
    expect(style.overflow).toBe('hidden')
    expect(style.getPropertyValue('-webkit-line-clamp')).toBe('2')
  })
})
