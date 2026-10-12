import { iconProps } from './iconColor'

describe('iconProps', () => {
  it('turns the fill given by Icon into the current colour of the drawing', () => {
    expect(iconProps({ style: { fill: '#FFCC00' } }).style).toEqual({
      fill: '#FFCC00',
      color: '#FFCC00'
    })
    const plain = { width: 20 }
    expect(iconProps(plain)).toBe(plain)
  })
})
