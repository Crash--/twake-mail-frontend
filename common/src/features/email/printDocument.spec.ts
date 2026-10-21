/**
 * @jest-environment jsdom
 */
import {
  buildPrintDocument,
  PRINT_BODY_SELECTOR,
  printHtmlDocument,
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

describe('printHtmlDocument', () => {
  let printed: (Element | null)[] = []

  afterEach(() => {
    document.body.replaceChildren()
    printed = []
  })

  const printFrom = async (opener: HTMLElement): Promise<HTMLIFrameElement> => {
    opener.focus()
    const printing = printHtmlDocument('<p>Body</p>')
    const frame = document.querySelector<HTMLIFrameElement>(
      '[data-testid="print-frame"]'
    )
    if (frame?.contentWindow === null || frame === null) {
      throw new Error('No print frame')
    }
    // As a browser does: printing focuses the frame
    jest.spyOn(frame.contentWindow, 'focus').mockImplementation(() => {
      frame.focus()
    })
    jest.spyOn(frame.contentWindow, 'print').mockImplementation(() => {
      printed.push(document.activeElement)
    })
    frame.dispatchEvent(new Event('load'))
    await printing
    return frame
  }

  it('gives the focus back to what started the print (#687)', async () => {
    const button = document.createElement('button')
    document.body.append(button)

    const frame = await printFrom(button)

    // The frame had the focus while the dialog was open
    expect(printed).toEqual([frame])
    expect(document.activeElement).toBe(button)
  })

  it('gives the focus back once the frame is gone, after the print dialog', async () => {
    const button = document.createElement('button')
    document.body.append(button)

    const frame = await printFrom(button)
    // The browser leaves the focus in the frame until the dialog closes
    frame.focus()
    frame.contentWindow?.dispatchEvent(new Event('afterprint'))

    expect(document.querySelector('[data-testid="print-frame"]')).toBe(null)
    expect(document.activeElement).toBe(button)
  })

  it('leaves the focus alone when the user moved it meanwhile', async () => {
    const button = document.createElement('button')
    const other = document.createElement('button')
    document.body.append(button, other)

    const frame = await printFrom(button)
    other.focus()
    frame.contentWindow?.dispatchEvent(new Event('afterprint'))

    expect(document.activeElement).toBe(other)
  })
})
