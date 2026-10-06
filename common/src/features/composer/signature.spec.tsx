import { removeSignatures, signatureHtml } from './signature'

const identity = (
  htmlSignature: string,
  textSignature = ''
): { htmlSignature: string; textSignature: string } => ({
  htmlSignature,
  textSignature
})

describe('signatureHtml', () => {
  it('writes the HTML signature after "-- ", sanitized, its images kept', () => {
    const html = signatureHtml(
      identity(
        '<p onclick="steal()">Alice <b>Martin</b></p><img src="https://assets.example.com/logo.png" alt="Logo"><script>alert(1)</script><style>body{display:none}</style><div style="position:fixed;color:red">Fixed</div>'
      )
    )
    expect(html).toContain(
      '<span class="tmail_signature_prefix">--&nbsp;</span><br>'
    )
    expect(html).toContain('<b>Martin</b>')
    expect(html).toContain('src="https://assets.example.com/logo.png"')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('script')
    expect(html).not.toContain('<style')
    expect(html).not.toContain('position')
  })

  it('escapes a text signature and keeps its lines', () => {
    expect(signatureHtml(identity('', 'Alice <CEO>\nACME'))).toBe(
      '<span class="tmail_signature_prefix">--&nbsp;</span><br>Alice &lt;CEO&gt;<br>ACME<br>'
    )
  })

  it('is null without a signature', () => {
    expect(signatureHtml(identity('  ', ''))).toBe(null)
  })
})

describe('removeSignatures', () => {
  it('drops the signature block this composer writes', () => {
    expect(
      removeSignatures(
        '<p>Hello</p><div data-html-block="signature" data-html-block-display="inline">-- <br>Alice</div>'
      )
    ).toBe('<p>Hello</p>')
  })

  it('drops the signature wrapper of tmail-flutter', () => {
    expect(
      removeSignatures(
        '<div>Hello</div><div class="tmail-signature">-- <br>Alice</div>'
      )
    ).toBe('<div>Hello</div>')
  })

  it('keeps a signature quoted in an older email', () => {
    const html =
      '<p>Hello</p><div data-html-block="quote"><div class="tmail-signature">Bob</div></div>'
    expect(removeSignatures(html)).toBe(html)
  })

  it('leaves a body without signature as it is', () => {
    const html = '<p>Hello <b>world</b></p>'
    expect(removeSignatures(html)).toBe(html)
  })
})
