import { sanitizeEmailHtml } from './sanitizeEmailHtml'

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function clean(html: string): string {
  return sanitizeEmailHtml(html).html
}

describe('sanitizeEmailHtml', () => {
  describe('autolink', () => {
    it('leaves bare URLs as text by default (composer quote)', () => {
      expect(clean('<p>https://example.com</p>')).toBe(
        '<p>https://example.com</p>'
      )
    })

    it('links bare URLs once sanitized when asked', () => {
      expect(
        sanitizeEmailHtml('<p onclick="x()">https://example.com</p>', {
          autolink: true
        }).html
      ).toBe(
        '<p><a href="https://example.com/" target="_blank" rel="noopener noreferrer">https://example.com</a></p>'
      )
    })

    it.each([
      [
        'an encoded script',
        '&lt;script&gt;alert(1)&lt;/script&gt; www.example.com'
      ],
      [
        'a URL closing the attribute',
        'https://example.com/"onmouseover="alert(1)'
      ],
      [
        'a URL holding markup',
        'https://example.com/&lt;img src=x onerror=alert(1)&gt;'
      ],
      ['a javascript URL', 'javascript:alert(1)//https://example.com'],
      [
        'a style sheet URL',
        '<style>a { background: url(https://example.com) }</style>x'
      ]
    ])('produces no script, handler nor other scheme from %s', (_, html) => {
      const container = document.createElement('div')
      container.innerHTML = sanitizeEmailHtml(html, { autolink: true }).html

      expect(container.querySelector('script, img, style a')).toBe(null)
      container.querySelectorAll('*').forEach(element => {
        Array.from(element.attributes).forEach(attribute => {
          expect(attribute.name.startsWith('on')).toBe(false)
        })
      })
      container.querySelectorAll('a').forEach(link => {
        expect(link.getAttribute('href')).toMatch(/^(https:|mailto:)/)
      })
    })
  })

  describe('XSS', () => {
    it.each([
      ['a script', '<script>alert(1)</script>'],
      ['an event handler', '<img src="x" onerror="alert(1)">'],
      [
        'an SVG event handler',
        '<svg onload="alert(1)"><circle></circle></svg>'
      ],
      ['a javascript link', '<a href="javascript:alert(1)">x</a>'],
      ['a spaced javascript link', '<a href="java\tscript:alert(1)">x</a>'],
      [
        'an entity-encoded javascript link',
        '<a href="&#106;avascript:alert(1)">x</a>'
      ],
      ['a vbscript link', '<a href="vbscript:msgbox(1)">x</a>'],
      [
        'a data:text/html link',
        '<a href="data:text/html,<script>alert(1)</script>">x</a>'
      ],
      ['an iframe', '<iframe src="https://evil.example.com"></iframe>'],
      ['an object', '<object data="https://evil.example.com/x.swf"></object>'],
      ['an embed', '<embed src="https://evil.example.com/x.swf">'],
      [
        'a meta refresh',
        '<meta http-equiv="refresh" content="0;url=https://evil.example.com">'
      ],
      ['a base', '<base href="https://evil.example.com/">'],
      ['a CSS expression', '<p style="width: expression(alert(1))">x</p>'],
      [
        'a CSS binding',
        '<p style="-moz-binding: url(https://evil.example.com/x.xml#x)">x</p>'
      ],
      [
        'a CSS javascript url',
        '<p style="background: url(javascript:alert(1))">x</p>'
      ],
      [
        'a style break-out',
        '<style>p { color: red }</style><style></style><script>alert(1)</script></style>'
      ],
      ['a template script', '<template><script>alert(1)</script></template>'],
      [
        'a math href',
        '<math><mi xlink:href="javascript:alert(1)">x</mi></math>'
      ],
      [
        'a form action',
        '<form action="javascript:alert(1)"><button>go</button></form>'
      ]
    ])('neutralizes %s', (_name, html) => {
      expect(clean(html)).not.toMatch(
        /<script|alert\(|onerror|onload|javascript:|vbscript:|data:text|<iframe|<object|<embed|<meta|<base|expression\(|binding|<form|<button/i
      )
    })

    it('keeps a <style> element from closing itself', () => {
      const html = clean(
        '<style>p::after { content: "</style><img src=x onerror=alert(1)>" }</style>'
      )

      // The parser ends the <style> at its first </style>: what follows is
      // sanitized as HTML, and no '<' is left in the style text
      expect(html).not.toMatch(/onerror|alert/)
      expect(html).toMatch(/^<style>[^<]*<\/style>/)
    })

    it('removes form controls with their content but keeps the text around', () => {
      expect(
        clean(
          '<form action="https://evil.example.com"><p>Your password:</p><input name="password"><select><option>secret</option></select></form>'
        )
      ).toBe('<p>Your password:</p>')
    })
  })

  describe('allow-list of tmail-flutter', () => {
    it('keeps the formatting tags and unwraps the unknown ones', () => {
      expect(
        clean(
          '<article><h1>Title</h1><p><b>bold</b> <font color="red">red</font></p><center>c</center></article>'
        )
      ).toBe(
        '<h1>Title</h1><p><b>bold</b> <font color="red">red</font></p><center>c</center>'
      )
    })

    it('keeps the table attributes of newsletters', () => {
      expect(
        clean(
          '<table width="600" cellpadding="0" bgcolor="#ffffff" align="center"><tbody><tr><td valign="top" colspan="2">x</td></tr></tbody></table>'
        )
      ).toBe(
        '<table width="600" cellpadding="0" bgcolor="#ffffff" align="center"><tbody><tr><td valign="top" colspan="2">x</td></tr></tbody></table>'
      )
    })

    it('drops the attributes it does not know, data-* and role included', () => {
      expect(
        clean(
          '<p data-track="1" role="button" contenteditable="true" title="t">x</p>'
        )
      ).toBe('<p title="t">x</p>')
    })

    it('keeps valid ids and class names only', () => {
      expect(clean('<p id="1bad" class="ok -bad also_ok">x</p>')).toBe(
        '<p class="ok also_ok">x</p>'
      )
      expect(clean('<p id="good:id">x</p>')).toBe('<p id="good:id">x</p>')
    })

    it('allows http, https, mailto and relative links only', () => {
      expect(clean('<a href="mailto:bob@example.com">mail</a>')).toContain(
        'href="mailto:bob@example.com"'
      )
      expect(clean('<a href="#part">anchor</a>')).toContain('href="#part"')
      expect(clean('<a href="tel:+33100000000">call</a>')).toBe('<a>call</a>')
      expect(clean('<a href="//evil.example.com">x</a>')).toBe('<a>x</a>')
    })

    it('opens links in a new tab without access to the app', () => {
      expect(
        clean('<a href="https://linagora.com" target="_self">Linagora</a>')
      ).toBe(
        '<a href="https://linagora.com" target="_blank" rel="noopener noreferrer">Linagora</a>'
      )
    })

    it('keeps raster data images, never SVG ones', () => {
      expect(clean(`<img src="${PNG}">`)).toBe(`<img src="${PNG}">`)
      expect(
        clean('<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=">')
      ).toBe('<img>')
    })

    it('filters the CSS of style attributes', () => {
      expect(
        clean(
          '<p style="color: red; position: fixed; top: 0; font-size: 12px; overflow: evil">x</p>'
        )
      ).toBe('<p style="color: red; font-size: 12px">x</p>')
    })

    it('filters <style> elements, @media included, and drops @import', () => {
      expect(
        clean(
          '<style>@import url(https://evil.example.com/x.css); p { color: red; position: absolute } @media (max-width: 600px) { td { display: block; z-index: 9 } }</style><p>x</p>'
        )
      ).toBe(
        '<style>p { color: red }\n@media (max-width: 600px) { td { display: block } }</style><p>x</p>'
      )
    })

    it('keeps the <style> elements of the <head>', () => {
      expect(
        clean(
          '<html><head><style>p { color: red }</style><title>t</title></head><body><p>x</p></body></html>'
        )
      ).toBe('<style>p { color: red }</style><p>x</p>')
    })
  })

  describe('inline images', () => {
    it('points cid images at their downloaded part, keeps them without blocking', () => {
      const result = sanitizeEmailHtml(
        '<img src="cid:logo@example.com"><img src="cid:missing">',
        {
          inlineImageUrls: new Map([
            ['logo@example.com', 'blob:https://mail.example.com/1']
          ])
        }
      )

      expect(result).toEqual({
        html: '<img src="blob:https://mail.example.com/1"><img>',
        blockedRemoteContent: 0
      })
    })
  })

  describe('remote content', () => {
    const TRACKED = [
      '<img src="https://tracker.example.com/open.gif" width="1" height="1" alt="">',
      '<img src="http://images.example.com/a.png" srcset="https://images.example.com/a@2x.png 2x">',
      '<table><tbody><tr><td style="background-image: url(https://images.example.com/bg.png); color: red">x</td></tr></tbody></table>',
      '<div style="background: #fff url(\'https://images.example.com/bg.png\') no-repeat">x</div>',
      '<style>.hero { background: url(https://images.example.com/hero.png) }</style>',
      '<style>@font-face { font-family: Brand; src: url(https://fonts.example.com/brand.woff2) }</style>',
      '<style>@import url("https://css.example.com/remote.css");</style>'
    ].join('')

    it('leaves out remote images, backgrounds, srcset, fonts and stylesheets by default', () => {
      const result = sanitizeEmailHtml(TRACKED)

      expect(result.html).not.toMatch(/example\.com/)
      expect(result.blockedRemoteContent).toBe(8)
      // What is not remote stays
      expect(result.html).toContain('color: red')
      expect(result.html).toContain('<img width="1" height="1" alt="">')
    })

    it('keeps them once allowed, without sending the referrer', () => {
      const result = sanitizeEmailHtml(TRACKED, { allowRemoteContent: true })

      expect(result.blockedRemoteContent).toBe(0)
      expect(result.html).toContain(
        '<img src="https://tracker.example.com/open.gif" width="1" height="1" alt="" referrerpolicy="no-referrer" loading="lazy">'
      )
      expect(result.html).toContain(
        'srcset="https://images.example.com/a@2x.png 2x"'
      )
      expect(result.html).toContain(
        'background-image: url(https://images.example.com/bg.png)'
      )
      expect(result.html).toContain(
        '@font-face { font-family: Brand; src: url(https://fonts.example.com/brand.woff2) }'
      )
      // Never followed, even when allowed
      expect(result.html).not.toContain('@import')
    })

    it('never loads relative or protocol-relative images, which would hit the app', () => {
      const result = sanitizeEmailHtml(
        '<img src="/api/track"><img src="//evil.example.com/p.gif"><p style="background: url(/x.png)">x</p>',
        { allowRemoteContent: true }
      )

      expect(result.html).toBe('<img><img><p>x</p>')
    })

    it('does not count an email without remote content', () => {
      expect(
        sanitizeEmailHtml(`<p>Hello</p><img src="${PNG}">`).blockedRemoteContent
      ).toBe(0)
    })
  })
})
