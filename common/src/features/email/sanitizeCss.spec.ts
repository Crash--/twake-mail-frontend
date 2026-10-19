import { sanitizeStyleSheet } from './sanitizeCss'

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
