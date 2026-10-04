import { fromEmailHtml, htmlToText, toEmailHtml } from './emailHtml'

// Cases in the spirit of the email exporter tests of Messages (La Suite
// numérique, src/frontend/src/features/blocknote/email-exporter/
// index.test.tsx, MIT, © DINUM): lists, quotes, links, images.
describe('toEmailHtml', () => {
  it('writes lines as divs, empty ones with a line break', () => {
    expect(toEmailHtml('<p>Hello</p><p></p><p>World</p>')).toBe(
      '<div>Hello</div><div><br></div><div>World</div>'
    )
  })

  it('unwraps list item paragraphs and styles lists and quotes inline', () => {
    expect(
      toEmailHtml(
        '<ul><li><p>One</p><p>more</p></li></ul><blockquote><p>Quoted</p></blockquote>'
      )
    ).toBe(
      '<ul style="margin:0 0 0 0;padding-left:24px;"><li>One<br>more</li></ul>' +
        '<blockquote style="margin-left:8px;margin-right:8px;padding-left:12px;padding-right:12px;border-left:5px solid #eee;"><div>Quoted</div></blockquote>'
    )
  })

  it('points images at their Content-ID', () => {
    expect(
      toEmailHtml(
        '<p><img src="blob:x" alt="logo" data-reference="a@twake.mail"></p>'
      )
    ).toBe(
      '<div><img src="cid:a@twake.mail" alt="logo" style="max-width:100%;"></div>'
    )
  })

  it('leaves kept HTML blocks alone and marks the signature for tmail-flutter', () => {
    const html =
      '<div data-html-block="signature" data-html-block-display="inline"><p>Sig</p></div>' +
      '<div data-html-block="quote"><p>Q</p><ul><li><p>x</p></li></ul></div>'

    expect(toEmailHtml(html)).toBe(
      '<div data-html-block="signature" data-html-block-display="inline" class="tmail-signature" style="clear: both; display: block;"><p>Sig</p></div>' +
        '<div data-html-block="quote"><p>Q</p><ul><li><p>x</p></li></ul></div>'
    )
  })
})

describe('fromEmailHtml', () => {
  it('shows cid images of the message, not those of a kept block', () => {
    expect(
      fromEmailHtml(
        '<div><img src="cid:a"></div><div data-html-block="quote"><img src="cid:b"></div>',
        cid => `blob:${cid}`
      )
    ).toBe(
      '<div><img src="blob:a" data-reference="a"></div><div data-html-block="quote"><img src="cid:b"></div>'
    )
  })
})

describe('htmlToText', () => {
  it('writes lists, links and nested quotes as text', () => {
    const html =
      '<div>Hello <a href="https://twake.app">Twake</a></div>' +
      '<ol><li>first</li><li>second<ul><li>nested</li></ul></li></ol>' +
      '<blockquote><div>quoted</div><blockquote><div>deeper</div></blockquote></blockquote>'

    expect(htmlToText(html)).toBe(
      [
        'Hello Twake <https://twake.app>',
        '1. first',
        '2. second',
        '  - nested',
        '',
        '> quoted',
        '>',
        '> > deeper'
      ].join('\n')
    )
  })
})
