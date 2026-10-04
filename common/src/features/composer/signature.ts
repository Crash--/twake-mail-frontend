import DOMPurify from 'dompurify'
import type { Editor } from '@tiptap/core'
import type { Identity } from 'jmap-client-ts'

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/**
 * The signature block of an identity, as tmail-flutter writes it
 * (`asSignatureHtml`): `-- ` then the HTML signature, or the text one.
 * Null when the identity has none.
 */
export function signatureHtml(
  identity: Pick<Identity, 'htmlSignature' | 'textSignature'>
): string | null {
  const html = identity.htmlSignature.trim()
  const text = identity.textSignature.trim()
  if (html === '' && text === '') return null
  const content =
    html !== ''
      ? DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'form'] })
      : escapeHtml(text).replaceAll('\n', '<br>')
  return `<span class="tmail_signature_prefix">--&nbsp;</span><br>${content}<br>`
}

/** The editor HTML of the signature block (an inline HtmlBlock) */
export function signatureBlock(html: string): string {
  return `<div data-html-block="signature" data-html-block-display="inline">${html}</div>`
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
 * has no setting for it), or at the end.
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
  const node = {
    type: 'htmlBlock',
    attrs: { html, kind: 'signature', display: 'inline' }
  }
  const position = quote ? quote.pos : editor.state.doc.content.size
  editor.chain().insertContentAt(position, node).run()
}
