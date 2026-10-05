/**
 * The document "Print all" prints (tmail-flutter `PrintUtils.printEmail`):
 * the user's address at the top end, the subject, the sender and date, the
 * recipients (Reply-To, To, Cc, Bcc), the whole body (the quoted history
 * unfolded) and the list of attachments.
 */

export interface PrintRecipientLine {
  label: string
  value: string
}

export interface PrintAttachmentLine {
  name: string
  size: string
}

export interface PrintDocumentContent {
  lang: string
  /** Title of the document: the app and the subject */
  title: string
  /** Who prints, at the top end */
  userName: string
  subject: string
  fromLabel: string
  senderName: string
  senderAddress: string
  date: string
  recipients: readonly PrintRecipientLine[]
  /** Sanitized HTML of the body */
  bodyHtml: string
  /** "2 attachments", empty for none */
  attachmentsTitle: string
  attachments: readonly PrintAttachmentLine[]
  allowRemoteContent: boolean
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const PRINT_CSS = `
body, td { font-family: Inter, Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 13px; }
body { margin: 0; color: #1b1b1f; overflow-wrap: anywhere; }
a:link, a:active { color: #1155cc; text-decoration: none; }
img { border: 0; max-width: 100%; height: auto; }
pre { white-space: pre-wrap; word-wrap: break-word; max-width: 800px; }
.tmail-plain-text { white-space: pre-wrap; }
blockquote { margin: 0 0 0 8px; padding-left: 8px; border-left: 2px solid #c4c4c4; }
.user { text-align: end; color: #777; font-weight: bold; }
.subject { font-size: 1.2em; font-weight: bold; margin: 8px 0; }
.sender { display: flex; justify-content: space-between; gap: 16px; font-size: 0.9em; }
.recipient { padding-bottom: 4px; font-size: 0.9em; }
.content { padding: 12px 0; }
.attachments { margin: 8px 0; padding: 0; list-style: none; }
.attachments li { padding: 4px 0; }
`

/** The whole HTML document to print; every text is escaped */
export function buildPrintDocument(content: PrintDocumentContent): string {
  const recipients = content.recipients
    .filter(line => line.value !== '')
    .map(
      line =>
        `<div class="recipient">${escapeHtml(line.label)}: ${escapeHtml(line.value)}</div>`
    )
    .join('')
  const attachments =
    content.attachments.length === 0
      ? ''
      : `<hr><section><b>${escapeHtml(content.attachmentsTitle)}</b><ul class="attachments">${content.attachments
          .map(
            file =>
              `<li><b>${escapeHtml(file.name)}</b><br>${escapeHtml(file.size)}</li>`
          )
          .join('')}</ul></section>`
  const remote = content.allowRemoteContent ? ' https: http:' : ''
  const policy = [
    "default-src 'none'",
    `img-src data: blob:${remote}`,
    "style-src 'unsafe-inline'",
    `font-src data:${remote}`
  ].join('; ')
  return [
    `<!doctype html><html lang="${escapeHtml(content.lang)}"><head><meta charset="utf-8">`,
    `<meta http-equiv="Content-Security-Policy" content="${policy}">`,
    '<meta name="referrer" content="no-referrer">',
    `<title>${escapeHtml(content.title)}</title>`,
    `<style>${PRINT_CSS}</style></head><body>`,
    `<div class="user">${escapeHtml(content.userName)}</div><hr>`,
    `<div class="subject">${escapeHtml(content.subject)}</div><hr>`,
    `<div class="sender"><span>${escapeHtml(content.fromLabel)}: <b>${escapeHtml(content.senderName)}</b> &lt;${escapeHtml(content.senderAddress)}&gt;</span><span>${escapeHtml(content.date)}</span></div>`,
    recipients,
    `<div class="content">${content.bodyHtml}</div>`,
    attachments,
    '</body></html>'
  ].join('')
}

/** How long a print frame stays when the browser never says it is done */
const PRINT_FRAME_TIMEOUT_MS = 120_000

/**
 * Prints an HTML document through a frame out of sight, so that no tab nor
 * pop-up is needed. The frame is sandboxed without `allow-scripts`: nothing
 * in the document runs; the app calls `print()` itself. Resolves once the
 * print dialog was shown (and closed, where the browser tells), rejects
 * when the document cannot be loaded.
 */
export function printHtmlDocument(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('sandbox', 'allow-same-origin allow-modals')
    frame.setAttribute('aria-hidden', 'true')
    frame.tabIndex = -1
    frame.title = ''
    frame.dataset.testid = 'print-frame'
    frame.style.cssText =
      'position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0;'
    let timer: ReturnType<typeof setTimeout> | undefined
    const cleanup = (): void => {
      clearTimeout(timer)
      frame.remove()
    }
    frame.addEventListener('load', () => {
      const printWindow = frame.contentWindow
      if (!printWindow) {
        cleanup()
        reject(new Error('Print frame without a window'))
        return
      }
      printWindow.addEventListener('afterprint', cleanup, { once: true })
      timer = setTimeout(cleanup, PRINT_FRAME_TIMEOUT_MS)
      try {
        printWindow.focus()
        printWindow.print()
        resolve()
      } catch (error: unknown) {
        cleanup()
        reject(error instanceof Error ? error : new Error('Cannot print'))
      }
    })
    frame.srcdoc = html
    document.body.append(frame)
  })
}
