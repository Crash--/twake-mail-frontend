import { normalizeImageStyle } from './imageSize'

describe('normalizeImageStyle', () => {
  it('turns a width and a height into a ratio, the height following the width', () => {
    for (const style of [
      'width: 2000px; height: 200px;',
      'width: 2000px;height: 200px;',
      'width:2000px;height:200px;'
    ]) {
      expect(normalizeImageStyle(style)).toBe(
        'width: 2000px; height: auto; aspect-ratio: 2000 / 200'
      )
    }
  })

  it('keeps the size of a small image, as a ratio too', () => {
    expect(normalizeImageStyle('width: 100px; height: 100px')).toBe(
      'width: 100px; height: auto; aspect-ratio: 100 / 100'
    )
  })

  it('reads the attributes when the style has no size', () => {
    expect(normalizeImageStyle(null, { width: '2000', height: '200' })).toBe(
      'height: auto; aspect-ratio: 2000 / 200'
    )
    expect(
      normalizeImageStyle('width: 100px', { width: '2000', height: '50' })
    ).toBe('width: 100px; height: auto; aspect-ratio: 100 / 50')
    expect(normalizeImageStyle(null, { width: '100%', height: '20' })).toBe(
      null
    )
    expect(normalizeImageStyle('', { width: null, height: null })).toBe('')
  })

  it('converts the absolute units', () => {
    expect(normalizeImageStyle('width: 450pt; height: 150pt')).toBe(
      'width: 450pt; height: auto; aspect-ratio: 600 / 200'
    )
  })

  it('leaves relative sizes and lone dimensions to the stylesheet', () => {
    expect(normalizeImageStyle('width: 50%; height: 200px')).toBe(
      'width: 50%; height: 200px'
    )
    expect(normalizeImageStyle('width: 2000px; border: 0')).toBe(
      'width: 2000px; border: 0'
    )
    expect(normalizeImageStyle('height: 2em; width: 3em')).toBe(
      'height: 2em; width: 3em'
    )
  })

  it('never lets an inline limit go past the pane', () => {
    expect(
      normalizeImageStyle('max-width: none; min-width: 1200px !important')
    ).toBe('max-width: 100%; min-width: min(1200px, 100%)')
    expect(normalizeImageStyle('max-width: 300px')).toBe(
      'max-width: min(300px, 100%)'
    )
  })

  it('keeps the other declarations, and no style', () => {
    expect(
      normalizeImageStyle(
        'border: 1px solid red; width: 20px; height: 10px; float: left'
      )
    ).toBe(
      'border: 1px solid red; width: 20px; float: left; height: auto; aspect-ratio: 20 / 10'
    )
    expect(normalizeImageStyle(null)).toBe(null)
  })
})
