import {
  elapsedMs,
  randomTexts,
  STRESS_TIME_LIMIT_MS
} from '@common/testing/redos'

import {
  removeComments,
  sanitizeDeclarations,
  sanitizeStyleSheet,
  urlArguments
} from './sanitizeCss'

// The patterns sanitizeCss used to run, quadratic on a failing text
const ORIGINAL_COMMENT = /\/\*[\s\S]{0,20000}?\*\//g
const ORIGINAL_URL_FUNCTION = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi

const BLOCKED = { allowRemoteContent: false }
const ALLOWED = { allowRemoteContent: true }

describe('sanitizeStyleSheet', () => {
  describe('@font-face', () => {
    it('drops a block without src and does not count it (Outlook boilerplate)', () => {
      const css =
        '@font-face {font-family:"Cambria Math"; panose-1:2 4 5 3 5 4 6 3 2 4;}\n' +
        '@font-face {font-family:Calibri; panose-1:2 15 5 2 2 2 4 3 2 4;}\n' +
        'p.MsoNormal {margin:0cm; font-family:"Calibri",sans-serif;}'

      expect(sanitizeStyleSheet(css, BLOCKED)).toEqual({
        css: 'p.MsoNormal { margin: 0cm; font-family: "Calibri",sans-serif }',
        blockedRemoteContent: 0
      })
      expect(sanitizeStyleSheet(css, ALLOWED).css).not.toContain('@font-face')
    })

    it('drops a block with local() sources only and does not count it', () => {
      const css = '@font-face { font-family: Brand; src: local("Brand Sans") }'

      expect(sanitizeStyleSheet(css, BLOCKED)).toEqual({
        css: '',
        blockedRemoteContent: 0
      })
      expect(sanitizeStyleSheet(css, ALLOWED).css).toBe('')
    })

    it('drops a block with a data: source and does not count it', () => {
      const css =
        '@font-face { font-family: Brand; src: url(data:font/woff2;base64,d09GMgABAAAAAA) }'

      expect(sanitizeStyleSheet(css, BLOCKED)).toEqual({
        css: '',
        blockedRemoteContent: 0
      })
    })

    it('counts a block loading an https font, and keeps it once allowed', () => {
      const css =
        '@font-face { font-family: Brand; src: url(https://fonts.example.com/brand.woff2) }'

      expect(sanitizeStyleSheet(css, BLOCKED)).toEqual({
        css: '',
        blockedRemoteContent: 1
      })
      expect(sanitizeStyleSheet(css, ALLOWED)).toEqual({
        css: '@font-face { font-family: Brand; src: url(https://fonts.example.com/brand.woff2) }',
        blockedRemoteContent: 0
      })
    })

    it('counts a block mixing local() and an https font', () => {
      const css =
        '@font-face { font-family: Brand; src: local(Brand), url("https://fonts.example.com/brand.woff2") format("woff2") }'

      expect(sanitizeStyleSheet(css, BLOCKED).blockedRemoteContent).toBe(1)
      expect(sanitizeStyleSheet(css, ALLOWED).css).toBe(
        '@font-face { font-family: Brand; src: local(Brand), url("https://fonts.example.com/brand.woff2") format("woff2") }'
      )
    })

    it.each([
      ['plain http', 'url(http://fonts.example.com/brand.woff2)'],
      ['protocol-relative', 'url(//fonts.example.com/brand.woff2)'],
      ['relative', 'url(/fonts/brand.woff2)']
    ])(
      'does not count a %s source, which is never loaded, even once allowed',
      (_kind, src) => {
        const css = `@font-face { font-family: Brand; src: ${src} }`

        expect(sanitizeStyleSheet(css, BLOCKED).blockedRemoteContent).toBe(0)
        expect(sanitizeStyleSheet(css, ALLOWED).css).toBe('')
      }
    )

    it('counts the https fonts of a @media block', () => {
      const css =
        '@media screen { @font-face { font-family: A; src: url(https://fonts.example.com/a.woff2) } @font-face { font-family: B } }'

      expect(sanitizeStyleSheet(css, BLOCKED).blockedRemoteContent).toBe(1)
    })
  })
})

describe('sanitizeDeclarations', () => {
  it('keeps the border of each side, which a newsletter button sets to 0 under a border-style', () => {
    // Without them, the 3 px default border widens the button out of its
    // cell, and fitting it into the cell pushes its text out of its height
    const css =
      'border-style:solid;border-top-width:0px;border-right-width:0px;border-bottom-width:0px;border-left-width:0px;' +
      'border-top-style:none;border-left-color:#e4e2dd;height:69px'

    expect(sanitizeDeclarations(css, BLOCKED).css).toBe(
      'border-style: solid; border-top-width: 0px; border-right-width: 0px; border-bottom-width: 0px; border-left-width: 0px; ' +
        'border-top-style: none; border-left-color: #e4e2dd; height: 69px'
    )
  })
})

describe('removeComments', () => {
  it('removes the comments the original pattern removed', () => {
    for (const css of randomTexts(['/', '*', '/*', '*/', 'a', ' '])) {
      expect([css, removeComments(css)]).toEqual([
        css,
        css.replace(ORIGINAL_COMMENT, '')
      ])
    }
  })

  it('keeps a comment longer than 20 000 characters, as before', () => {
    const long = `a/*${'x'.repeat(20_001)}*/b`
    const limit = `a/*${'x'.repeat(20_000)}*/b`
    expect(removeComments(long)).toBe(long.replace(ORIGINAL_COMMENT, ''))
    expect(removeComments(long)).toBe(long)
    expect(removeComments(limit)).toBe('ab')
    const inner = `/*${'x'.repeat(20_001)}/* y */z`
    expect(removeComments(inner)).toBe(inner.replace(ORIGINAL_COMMENT, ''))
  })
})

describe('urlArguments', () => {
  it('reads the arguments the original pattern read', () => {
    const values = randomTexts(
      ['url(', 'URL(', '(', ')', '"', "'", ' ', '\t', 'a', 'https://x'],
      { count: 5000 }
    )
    for (const value of values) {
      expect([value, urlArguments(value)]).toEqual([
        value,
        Array.from(value.matchAll(ORIGINAL_URL_FUNCTION), match => match[2])
      ])
    }
  })
})

describe('sanitizeCss against ReDoS', () => {
  const options = { allowRemoteContent: false }

  it.each([
    ['unclosed comments', 'color: red; /*x'.repeat(5000)],
    ['comments longer than the limit', '/*x'.repeat(20_000) + '*/'],
    ['url( without closing', 'background: ' + 'url('.repeat(20_000)],
    ['url( followed by spaces', 'background: url(' + ' '.repeat(50_000)],
    ['quoted url( never closed', "background: url('" + 'a'.repeat(50_000)],
    [
      'an important without value',
      'width:' + '\t'.repeat(50_000) + 'x!important'
    ],
    ['a line height', 'line-height:' + '\t'.repeat(50_000) + 'o!important'],
    ['an overflow', 'overflow:' + '\t'.repeat(50_000) + 'x!important']
  ])('filters %s in a linear time', (_, declarations) => {
    expect(
      elapsedMs(() => {
        sanitizeDeclarations(declarations, options)
        sanitizeStyleSheet(`p { ${declarations} }`, options)
      })
    ).toBeLessThan(STRESS_TIME_LIMIT_MS)
  })
})
