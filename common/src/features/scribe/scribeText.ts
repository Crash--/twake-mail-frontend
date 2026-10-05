/** What the user wrote, without what is not theirs (quote, signature, Drive cards) */
const NOT_WRITTEN =
  '[data-html-block], .tmail-signature, a.tmail-file-link-card, style, script'

/**
 * The text of the editor the assistant reads: one line per paragraph or
 * list item, without the quoted email, the signature nor the Drive cards.
 */
export function editorText(editorHtml: string): string {
  const body = new DOMParser().parseFromString(
    `<body>${editorHtml}</body>`,
    'text/html'
  ).body
  body.querySelectorAll(NOT_WRITTEN).forEach(element => {
    element.remove()
  })
  body.querySelectorAll('br').forEach(element => {
    element.replaceWith('\n')
  })
  const blocks = 'p, li, h1, h2, h3, blockquote, pre'
  // A block inside another (the paragraph of a list item) is read with it
  const lines = Array.from(body.querySelectorAll(blocks))
    .filter(
      element => (element.parentElement?.closest(blocks) ?? null) === null
    )
    .map(
      element =>
        `${element.tagName === 'LI' ? '- ' : ''}${element.textContent.trim()}`
    )
  return (lines.length > 0 ? lines.join('\n') : body.textContent)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/** The answer of the assistant as editor content: its lines as paragraphs, as text */
export function suggestionHtml(text: string): string {
  return text
    .split('\n')
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join('')
}
