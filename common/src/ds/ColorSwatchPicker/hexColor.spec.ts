import { normalizeHexColor } from './hexColor'

describe('normalizeHexColor', () => {
  it.each([
    ['#1a2b3c', '#1A2B3C'],
    ['1A2B3C', '#1A2B3C'],
    ['  #1a2b3c  ', '#1A2B3C'],
    ['#abc', '#AABBCC'],
    ['F0a', '#FF00AA']
  ])('reads %p as %p', (text, expected) => {
    expect(normalizeHexColor(text)).toBe(expected)
  })

  it.each(['', '#', '#12', '#1234', '#12345', '#1234567', '#GGGGGG', 'red'])(
    'refuses %p',
    text => {
      expect(normalizeHexColor(text)).toBe(null)
    }
  )
})
