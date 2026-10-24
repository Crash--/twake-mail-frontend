import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

import { MAX_LINK_LENGTH, SafeLink } from './safeLink'

// 50 000 characters: linkifyjs took 30 s on it in a browser
const HYPHENATED_RUN = 'a-'.repeat(25_000)

function makeEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ link: false }),
      SafeLink.configure({ autolink: true, defaultProtocol: 'https' })
    ]
  })
}

function linkHrefs(editor: Editor): string[] {
  return Array.from(editor.view.dom.querySelectorAll('a'), link =>
    link.getAttribute('href')
  ).filter(href => href !== null)
}

// jsdom has no ClipboardEvent, which `pasteText` makes without one
class PasteEvent extends Event {
  readonly clipboardData = null

  constructor() {
    super('paste')
  }
}

function paste(editor: Editor, text: string): void {
  editor.view.pasteText(text, new PasteEvent())
}

function timed(action: () => void): number {
  const start = performance.now()
  action()
  return performance.now() - start
}

describe('SafeLink', () => {
  it('pastes a long run of punctuated text at once, and links the rest', () => {
    const editor = makeEditor()

    const duration = timed(() => {
      paste(
        editor,
        `${HYPHENATED_RUN} see https://example.com/ok and example.org`
      )
    })

    expect(duration).toBeLessThan(1000)
    expect(editor.getText()).toContain(HYPHENATED_RUN)
    expect(linkHrefs(editor)).toEqual([
      'https://example.com/ok',
      'http://example.org'
    ])
  })

  it('types a space after a long run at once', () => {
    const editor = makeEditor()
    editor.commands.insertContent(HYPHENATED_RUN)

    const duration = timed(() => {
      editor.commands.insertContent(' ')
    })

    expect(duration).toBeLessThan(1000)
    expect(linkHrefs(editor)).toEqual([])
  })

  it('leaves the text typed right after a pasted URL out of its link', () => {
    const editor = makeEditor()
    paste(editor, 'see https://example.org/x')

    // Typed at the caret, as a keystroke inserts it
    editor.view.dispatch(editor.state.tr.insertText('xyz'))
    editor.view.dispatch(editor.state.tr.insertText(' more'))

    expect(editor.getHTML()).toBe(
      '<p>see <a target="_blank" rel="noopener noreferrer nofollow" href="https://example.org/x">https://example.org/x</a>xyz more</p>'
    )
  })

  it('still links a URL as it is typed', () => {
    const editor = makeEditor()

    editor.commands.insertContent('https://example.com/ok')
    editor.commands.insertContent(' ')

    expect(linkHrefs(editor)).toEqual(['https://example.com/ok'])
  })

  it('still links a URL up to the limit', () => {
    const editor = makeEditor()
    const url = `https://example.com/${'p'.repeat(MAX_LINK_LENGTH - 20)}`

    paste(editor, `${url} `)

    expect(linkHrefs(editor)).toEqual([url])
  })
})
