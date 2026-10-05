import { sanitizeEmailHtml } from '@common/features/email/sanitizeEmailHtml'

import { fromEmailHtml, toEmailHtml } from './emailHtml'

/**
 * What the toolbar writes (inline styles, as tmail-flutter's Summernote
 * does) must reach the recipient's reader: the sanitizer keeps these CSS
 * properties and tags.
 */
const FORMATTED =
  '<h2 style="text-align: center">Title</h2>' +
  '<p style="margin-left: 48px"><span style="font-family: Times New Roman; font-size: 24px; color: #ff4d4d; background-color: #ffd600">Hi</span></p>' +
  '<pre><code>code</code></pre>'

describe('formatting of the sent email', () => {
  it('keeps font, size, colour, highlight, indentation, alignment and headings through the sanitizer', () => {
    const sent = toEmailHtml(FORMATTED)
    const { html } = sanitizeEmailHtml(sent)

    expect(html).toContain('<h2 style="text-align: center')
    expect(html).toContain('margin-left: 48px')
    expect(html).toMatch(/font-family: ?(")?Times New Roman/)
    expect(html).toContain('font-size: 24px')
    expect(html).toMatch(/(^|[^-])color: ?#ff4d4d/)
    expect(html).toContain('background-color: #ffd600')
    expect(html).toContain('<pre><code>code</code></pre>')
  })

  it('gives the styles back to the editor when a draft is opened again', () => {
    const sent = toEmailHtml(FORMATTED)
    const editorHtml = fromEmailHtml(sent, () => null)

    expect(editorHtml).toContain('font-size: 24px')
    expect(editorHtml).toContain('background-color: #ffd600')
    expect(editorHtml).toContain('margin-left: 48px')
  })
})
