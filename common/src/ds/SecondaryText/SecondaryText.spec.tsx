import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { SecondaryText } from './SecondaryText'

/** Relative luminance, WCAG 2.1 */
function luminance(rgb: readonly number[]): number {
  const [r = 0, g = 0, b = 0] = rgb.map(value => {
    const channel = value / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

describe('SecondaryText', () => {
  it('has an AA contrast on white', () => {
    renderDs(<SecondaryText data-testid="text">Yesterday</SecondaryText>)

    const color = getComputedStyle(screen.getByTestId('text')).color
    expect(color).toMatch(/^rgba?\(/)
    const [r = 0, g = 0, b = 0, a = 1] =
      color.match(/[\d.]+/g)?.map(Number) ?? []
    const onWhite = [r, g, b].map(channel => a * channel + (1 - a) * 255)
    const ratio = (1 + 0.05) / (luminance(onWhite) + 0.05)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

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
