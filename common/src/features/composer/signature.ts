import type { Editor } from '@tiptap/core'
import type { Identity } from 'jmap-client-ts'

import { sanitizeEmailHtml } from '@common/features/email/sanitizeEmailHtml'

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/**
 * An HTML signature, shown in the page of the composer: sanitized as an
 * email body (tags, attributes, CSS of tmail-flutter's list), its images
 * kept (the user's own, or PublicAsset URLs), without style sheets, which
 * would restyle the app
 */
export function sanitizeSignature(html: string): string {
  const sanitized = sanitizeEmailHtml(html, { allowRemoteContent: true }).html
  if (!/<style/i.test(sanitized)) return sanitized
  const root = new DOMParser().parseFromString(
    `<body>${sanitized}</body>`,
    'text/html'
  ).body
  root.querySelectorAll('style').forEach(style => {
    style.remove()
  })
  return root.innerHTML
}

/**
 * The signature block of an identity, as tmail-flutter writes it
 * (`asSignatureHtml`): `-- ` then the HTML signature, or the text one
 * (escaped, its lines kept; tmail-flutter inserts it raw). Null when the
 * identity has none.
 */
export function signatureHtml(
  identity: Pick<Identity, 'htmlSignature' | 'textSignature'>
): string | null {
  const html = identity.htmlSignature.trim()
  const text = identity.textSignature.trim()
  if (html === '' && text === '') return null
  const content =
    html !== ''
      ? sanitizeSignature(html)
      : escapeHtml(text).replaceAll('\n', '<br>')
  return `<span class="tmail_signature_prefix">--&nbsp;</span><br>${content}<br>`
}

/** The editor HTML of the signature block (an inline HtmlBlock) */
export function signatureBlock(html: string): string {
  return `<div data-html-block="signature" data-html-block-display="inline">${html}</div>`
}

/**
 * The editor HTML without its signature: the block this composer writes
 * (`data-html-block="signature"`) and tmail-flutter's `tmail-signature`
 * wrapper. A signature quoted in an older email (inside a quote block) is
 * content, not the signature of the message, and stays.
 */
export function removeSignatures(html: string): string {
  if (!/data-html-block="signature"|tmail-signature/i.test(html)) return html
  const root = new DOMParser().parseFromString(
    `<body>${html}</body>`,
    'text/html'
  ).body
  root
    .querySelectorAll('[data-html-block="signature"], .tmail-signature')
    .forEach(signature => {
      if (signature.closest('[data-html-block="quote"]') === null) {
        signature.remove()
      }
    })
  return root.innerHTML
}

function findBlock(
  editor: Editor,
  kind: string
): { pos: number; size: number } | null {
  let found: { pos: number; size: number } | null = null
  editor.state.doc.descendants((node, pos) => {
    if (found) return false
    if (node.type.name === 'htmlBlock' && node.attrs.kind === kind) {
      found = { pos, size: node.nodeSize }
      return false
    }
    return true
  })
  return found
}

/**
 * Puts the signature of the new identity in place of the current one. A
 * message without one gets it above the quote, like tmail-flutter (which
 * has no setting for it), or at the end. Whatever the user has typed, the
 * selection included, stays as it is.
 */
export function replaceSignature(editor: Editor, html: string | null): void {
  const current = findBlock(editor, 'signature')
  if (current) {
    const { tr } = editor.state
    if (html === null) {
      tr.delete(current.pos, current.pos + current.size)
    } else {
      tr.setNodeAttribute(current.pos, 'html', html)
    }
    editor.view.dispatch(tr)
    return
  }
  if (html === null) return
  const quote = findBlock(editor, 'quote')
  const node = editor.schema.nodes.htmlBlock?.create({
    html,
    kind: 'signature',
    display: 'inline'
  })
  if (!node) return
  // A plain insertion: the caret and what is typed stay where they are
  // (`insertContentAt` would move the caret after the signature)
  const position = quote ? quote.pos : editor.state.doc.content.size
  editor.view.dispatch(editor.state.tr.insert(position, node))
}
