import { pickLabelColor } from './labelPalette'

const SWATCHES = ['#273891', '#7E57E3', '#9E83E8']

describe('pickLabelColor', () => {
  it('draws among the swatches no label has yet, in any case', () => {
    expect(pickLabelColor(SWATCHES, ['#273891', '#7e57e3'], () => 0)).toBe(
      '#9E83E8'
    )
  })

  it('draws among all the swatches once each one is taken', () => {
    expect(pickLabelColor(SWATCHES, [...SWATCHES, null], () => 0.999)).toBe(
      '#9E83E8'
    )
    expect(pickLabelColor(SWATCHES, SWATCHES, () => 0)).toBe('#273891')
  })

  it('gives no colour without swatches', () => {
    expect(pickLabelColor([], [], () => 0)).toBe(null)
  })
})
