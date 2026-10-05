import { buildPrintDocument, type PrintDocumentContent } from './printDocument'

const CONTENT: PrintDocumentContent = {
  lang: 'en',
  title: 'Twake Mail - Hi',
  userName: 'alice@example.com',
  subject: 'Hi <b>there</b>',
  fromLabel: 'From',
  senderName: 'Bob "B"',
  senderAddress: 'bob@example.com',
  date: 'Monday',
  recipients: [
    { label: 'To', value: 'Alice <alice@example.com>' },
    { label: 'Cc', value: '' }
  ],
  bodyHtml: '<p>Body</p>',
  attachmentsTitle: '2 attachments',
  attachments: [
    { name: 'a<script>.pdf', size: '2 kB' },
    { name: 'b.png', size: '1 MB' }
  ],
  allowRemoteContent: false
}

describe('buildPrintDocument', () => {
  it('escapes every text but the sanitized body', () => {
    const html = buildPrintDocument(CONTENT)
    expect(html).toContain('Hi &lt;b&gt;there&lt;/b&gt;')
    expect(html).toContain('Bob &quot;B&quot;')
    expect(html).toContain('a&lt;script&gt;.pdf')
    expect(html).not.toContain('<script>')
    expect(html).toContain('<p>Body</p>')
  })

  it('leaves out empty recipient lines and attachments', () => {
    const html = buildPrintDocument({ ...CONTENT, attachments: [] })
    expect(html).toContain('To: Alice &lt;alice@example.com&gt;')
    expect(html).not.toContain('Cc:')
    expect(html).not.toContain('2 attachments')
  })

  it('forbids scripts and remote content by CSP unless allowed', () => {
    expect(buildPrintDocument(CONTENT)).toContain(
      "default-src 'none'; img-src data: blob:;"
    )
    expect(
      buildPrintDocument({ ...CONTENT, allowRemoteContent: true })
    ).toContain('img-src data: blob: https: http:;')
  })
})
