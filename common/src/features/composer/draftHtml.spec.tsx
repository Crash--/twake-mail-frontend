import { blockDisplay, sanitizeDraftHtml } from './draftHtml'

const FORGED_BLOCK =
  '<div data-html-block="x" data-html-block-display="inline">' +
  '<meta http-equiv="refresh" content="0;url=https://evil.example">' +
  '<img src="x" onerror="alert(1)"></div>'

describe('sanitizeDraftHtml', () => {
  it('drops a forged block and its active content', () => {
    const html = sanitizeDraftHtml(FORGED_BLOCK)

    expect(html).not.toContain('data-html-block')
    expect(html).not.toContain('<meta')
    expect(html).not.toContain('onerror')
  })

  it('drops scripts and handlers in the content', () => {
    const html = sanitizeDraftHtml(
      '<div onclick="alert(1)">Hi<script>alert(2)</script></div>'
    )

    expect(html).toBe('<div>Hi</div>')
  })

  it('gives its own signature back, inline, sanitized and without style sheets', () => {
    const html = sanitizeDraftHtml(
      '<div>Body</div><div data-html-block="signature" data-html-block-display="frame" class="tmail-signature">' +
        '<style>body { display: none }</style>-- <br>Alice<img src="x" onerror="alert(1)"></div>'
    )
    const signature = new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector('[data-html-block="signature"]')

    expect(signature?.getAttribute('data-html-block-display')).toBe('inline')
    expect(signature?.getAttribute('class')).toBe('tmail-signature')
    expect(signature?.innerHTML).toBe('-- <br>Alice<img>')
  })

  it('keeps its quote and Drive cards', () => {
    const html = sanitizeDraftHtml(
      '<div data-html-block="quote"><blockquote>Old</blockquote></div>' +
        '<div data-html-block="drive-card"><a class="tmail-file-link-card" href="https://drive.example/f">f</a></div>'
    )

    expect(html).toContain('<div data-html-block="quote"><blockquote>Old')
    expect(html).toContain(
      '<div data-html-block="drive-card" data-html-block-display="inline">'
    )
  })

  it('keeps the inline images by Content-ID', () => {
    expect(sanitizeDraftHtml('<img src="cid:logo@x">')).toContain(
      'src="cid:logo@x"'
    )
  })

  it('keeps only the quote of someone else email as a block', () => {
    const html = sanitizeDraftHtml(
      '<div data-html-block="signature" data-html-block-display="inline">Mallory</div>' +
        '<div data-html-block="quote"><div>Old</div></div>',
      { isForeign: true }
    )

    expect(html).toBe(
      '<div>Mallory</div><div data-html-block="quote"><div>Old</div></div>'
    )
  })

  it.each([true, false])(
    'never trusts a marker class written in the content (isForeign: %s)',
    isForeign => {
      const html = sanitizeDraftHtml(
        '<div class="twake-mail-kept-block-signature note"><img src="https://t.example/p"></div>' +
          '<div class="twake-mail-kept-block-quote">Old</div>',
        { isForeign }
      )

      expect(html).not.toContain('data-html-block')
      expect(html).not.toContain('twake-mail-kept-block-')
      expect(html).toContain('class="note"')
    }
  )
})

describe('blockDisplay', () => {
  it('shows the signature and the Drive cards in the page, anything else in a frame', () => {
    expect(blockDisplay('signature')).toBe('inline')
    expect(blockDisplay('drive-card')).toBe('inline')
    expect(blockDisplay('quote')).toBe('frame')
    expect(blockDisplay('x')).toBe('frame')
  })
})
