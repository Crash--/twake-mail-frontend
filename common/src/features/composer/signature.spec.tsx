import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

import { HtmlBlock } from '@/ds/RichTextEditor/htmlBlock'

import { removeSignatures, replaceSignature, signatureHtml } from './signature'

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

describe('replaceSignature', () => {
  const QUOTE = '<div data-html-block="quote"><blockquote>Hi</blockquote></div>'

  function makeEditor(content: string): Editor {
    return new Editor({
      extensions: [StarterKit.configure({ trailingNode: false }), HtmlBlock],
      content
    })
  }

  it('puts a signature that arrives late above the quote, without touching what was typed', () => {
    const editor = makeEditor(`<p>typed</p><p>more</p>${QUOTE}`)
    editor.commands.setTextSelection(3)
    const typed = editor.state.doc.content.content.map(node => node.textContent)

    replaceSignature(editor, '-- Alice')

    const kinds = editor.state.doc.content.content.map(node =>
      node.type.name === 'htmlBlock' ? String(node.attrs.kind) : node.type.name
    )
    expect(kinds).toEqual(['paragraph', 'paragraph', 'signature', 'quote'])
    expect(
      editor.state.doc.content.content.slice(0, 2).map(node => node.textContent)
    ).toEqual(typed.slice(0, 2))
    expect(editor.state.selection.from).toBe(3)
  })

  it('replaces the signature in place when there is one', () => {
    const editor = makeEditor(
      `<p>typed</p><div data-html-block="signature">-- Alice</div>${QUOTE}`
    )

    replaceSignature(editor, '-- Bob')

    const html = editor.getHTML()
    expect(html).toContain('-- Bob')
    expect(html).not.toContain('-- Alice')
    expect(html.match(/data-html-block="signature"/g)).toHaveLength(1)
  })
})
