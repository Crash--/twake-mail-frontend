import { foldText, graphemes } from './graphemes'

describe('graphemes', () => {
  it('keeps a letter with its accents and an emoji whole', () => {
    expect(graphemes('Zoé 👍🏽 🇫🇷 👨‍👩‍👧')).toEqual([
      'Z',
      'o',
      'é',
      ' ',
      '👍🏽',
      ' ',
      '🇫🇷',
      ' ',
      '👨‍👩‍👧'
    ])
  })
})

describe('foldText', () => {
  it('drops case and accents, composed or decomposed', () => {
    expect(foldText('Zoé')).toBe('zoe')
    expect(foldText('ZOÉ')).toBe('zoe')
  })
})
