import { buildQuoteHtml, prefixSubject, type QuoteLabels } from './quote'
import { threadHeaders } from './replyContent'

const LABELS: QuoteLabels = {
  replyHeader: (date, address) => `Le ${date}, de ${address}`,
  forwarded: 'Message transféré',
  subject: 'Sujet',
  date: 'Date',
  from: 'De',
  to: 'À',
  cc: 'Copie à',
  bcc: 'Copie cachée à',
  replyTo: 'Répondre à'
}

describe('prefixSubject', () => {
  it('adds the prefix of the UI language once', () => {
    expect(prefixSubject('Plans', 'Fwd:', 'Tr:')).toBe('Tr: Plans')
    expect(prefixSubject('TR: Plans', 'Fwd:', 'Tr:')).toBe('TR: Plans')
    expect(prefixSubject('fwd: Plans', 'Fwd:', 'Tr:')).toBe('fwd: Plans')
    expect(prefixSubject('  Re: Plans', 'Re:', 'Re:')).toBe('  Re: Plans')
    expect(prefixSubject(null, 'Re:', 'Re:')).toBe('Re: ')
  })
})

describe('buildQuoteHtml', () => {
  const email = {
    receivedAt: '2026-03-05T14:04:00Z',
    subject: 'Plans <draft>',
    from: [{ name: 'Emma', email: 'emma@example.com' }],
    to: [{ name: null, email: 'bob@example.com' }],
    cc: null,
    bcc: null,
    replyTo: null,
    html: '<p>Hello</p><script>alert(1)</script>'
  }

  it('quotes a reply under a localized header, sanitized', () => {
    const html = buildQuoteHtml('reply', email, LABELS, 'fr')
    expect(html).toContain('Le ')
    expect(html).toContain('de Emma &lt;emma@example.com&gt;')
    expect(html).toContain('<blockquote')
    expect(html).toContain('<p>Hello</p>')
    expect(html).not.toContain('script')
  })

  it('lists the fields of a forwarded email, the empty ones left out', () => {
    const html = buildQuoteHtml('forward', email, LABELS, 'fr')
    expect(html).toContain('------- Message transféré -------')
    expect(html).toContain('Sujet: Plans &lt;draft&gt;')
    expect(html).toContain('À: &lt;bob@example.com&gt;')
    expect(html).not.toContain('Copie à')
  })
})

describe('threadHeaders', () => {
  const source = { messageId: ['b@x'], references: ['a@x'] }

  it('answers in the thread of the email', () => {
    expect(threadHeaders(source, 'reply')).toEqual({
      inReplyTo: ['b@x'],
      references: ['a@x', 'b@x']
    })
    expect(threadHeaders(source, 'forward')).toEqual({
      inReplyTo: null,
      references: ['a@x', 'b@x']
    })
    expect(
      threadHeaders({ messageId: null, references: null }, 'reply')
    ).toEqual({ inReplyTo: null, references: null })
  })
})
