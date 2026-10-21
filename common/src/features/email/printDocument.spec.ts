import {
  buildPrintDocument,
  PRINT_BODY_SELECTOR,
  type PrintDocumentContent
} from './printDocument'

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

  it('clips the body in a frame out of reach of its scoped CSS (tf#4873)', () => {
    const html = buildPrintDocument(CONTENT)
    expect(html).toContain(
      `<div class="frame"><div class="${PRINT_BODY_SELECTOR.slice(1)}"><p>Body</p></div></div>`
    )
    // `:scope { padding: 0; overflow: visible }` reaches the body, not this
    expect(html).toContain('.frame { overflow-y: clip; display: flow-root; }')
    expect(html).not.toMatch(/\.content \{[^}]*overflow/)
  })

  it('leaves out empty recipient lines and attachments', () => {
    const html = buildPrintDocument({ ...CONTENT, attachments: [] })
    expect(html).toContain('To: Alice &lt;alice@example.com&gt;')
    expect(html).not.toContain('Cc:')
    expect(html).not.toContain('2 attachments')
  })

  it('writes the sender as the To and Cc lines: the address alone without a name', () => {
    expect(buildPrintDocument(CONTENT)).toContain(
      'From: <b>Bob &quot;B&quot;</b> &lt;bob@example.com&gt;</span>'
    )
    const html = buildPrintDocument({ ...CONTENT, senderName: ' ' })
    expect(html).toContain('<span>From: bob@example.com</span>')
    expect(html).not.toContain('<b></b>')
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
