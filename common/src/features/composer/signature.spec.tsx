import { signatureHtml } from './signature'

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
