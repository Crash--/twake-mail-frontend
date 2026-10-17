import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

import { HtmlBlock } from './htmlBlock'
import { QuoteBlock, QuoteCite, QuoteKeys } from './quoteBlock'

const CITE =
  '<cite style="text-align: left; display: block;">On Monday, Bob wrote:</cite>'

function quote(...paragraphs: string[]): string {
  return `<div data-html-block="quote">${CITE}<blockquote>${paragraphs
    .map(text => `<p>${text}</p>`)
    .join('')}</blockquote></div>`
}

function makeEditor(content: string): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ trailingNode: false }),
      HtmlBlock,
      QuoteBlock,
      QuoteCite,
      QuoteKeys
    ],
    content
  })
}

/** Puts the caret right after `text` (its first occurrence) */
function placeCaretAfter(editor: Editor, text: string): void {
  const positions: number[] = []
  editor.state.doc.descendants((node, position) => {
    const index = node.isText ? (node.text ?? '').indexOf(text) : -1
    if (index !== -1) positions.push(position + index + text.length)
    return positions.length === 0
  })
  const [found] = positions
  if (found === undefined) throw new Error(`No "${text}" in the document`)
  editor.commands.setTextSelection(found)
}

/** Puts the caret right before `text` */
function placeCaretBefore(editor: Editor, text: string): void {
  placeCaretAfter(editor, text)
  editor.commands.setTextSelection(editor.state.selection.from - text.length)
}

/** A key pressed as the browser gives it, outside any command */
function press(editor: Editor, key: string, shiftKey = false): void {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true })
  editor.view.someProp('handleKeyDown', handle => handle(editor.view, event))
}

function pressEnter(editor: Editor): void {
  press(editor, 'Enter')
}

/** The top level blocks: their type, and their text */
function outline(editor: Editor): string[] {
  return editor.state.doc.content.content.map(
    node => `${node.type.name}: ${node.textContent}`
  )
}

describe('QuoteBlock', () => {
  it('reads the quote as text to edit, in its wrapper, with its cite line', () => {
    const editor = makeEditor(`<p>Hi</p>${quote('One', 'Two')}`)

    expect(outline(editor)).toEqual([
      'paragraph: Hi',
      'quoteBlock: On Monday, Bob wrote:OneTwo'
    ])
    expect(editor.getHTML()).toBe(
      `<p>Hi</p><div data-html-block="quote">${CITE}<blockquote><p>One</p><p>Two</p></blockquote></div>`
    )
    editor.destroy()
  })

  it('lets the user change the quoted text', () => {
    const editor = makeEditor(quote('One', 'Two'))
    placeCaretAfter(editor, 'One')

    editor.commands.insertContent(' and a half')

    expect(editor.getHTML()).toContain('<p>One and a half</p><p>Two</p>')
    editor.destroy()
  })

  it('keeps a cite outside a quote as text', () => {
    const editor = makeEditor('<p>As <cite>the book</cite> says</p>')

    expect(editor.getHTML()).toBe('<p>As the book says</p>')
    editor.destroy()
  })

  it('keeps the other HTML blocks whole', () => {
    const editor = makeEditor(
      `<div data-html-block="signature">-- Me</div>${quote('One')}`
    )

    expect(outline(editor).map(line => line.split(':')[0])).toEqual([
      'htmlBlock',
      'quoteBlock'
    ])
    editor.destroy()
  })
})

describe('Enter in a quote', () => {
  it('cuts the quote in two and writes between the halves, at the level of the message', () => {
    const editor = makeEditor(`<p>Hi</p>${quote('First line', 'Second line')}`)
    placeCaretAfter(editor, 'First')

    pressEnter(editor)
    editor.commands.insertContent('My answer')

    expect(outline(editor)).toEqual([
      'paragraph: Hi',
      'quoteBlock: On Monday, Bob wrote:First',
      'paragraph: My answer',
      'quoteBlock:  lineSecond line'
    ])
    editor.destroy()
  })

  it('leaves no empty quoted line at the end of a quoted paragraph', () => {
    const editor = makeEditor(quote('One', 'Two', 'Three'))
    placeCaretAfter(editor, 'Two')

    pressEnter(editor)

    expect(editor.getHTML()).toBe(
      `<div data-html-block="quote">${CITE}<blockquote><p>One</p><p>Two</p></blockquote></div>` +
        '<p></p>' +
        '<div data-html-block="quote"><blockquote><p>Three</p></blockquote></div>'
    )
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
    expect(editor.state.selection.$from.depth).toBe(1)
    editor.destroy()
  })

  it('writes after the quote at the end of its last line', () => {
    const editor = makeEditor(`<p>Hi</p>${quote('One', 'Two')}`)
    placeCaretAfter(editor, 'Two')

    pressEnter(editor)
    editor.commands.insertContent('After')

    expect(outline(editor)).toEqual([
      'paragraph: Hi',
      'quoteBlock: On Monday, Bob wrote:OneTwo',
      'paragraph: After'
    ])
    editor.destroy()
  })

  it('writes between the cite line and the quoted text at the start of its first line', () => {
    const editor = makeEditor(quote('One', 'Two'))
    placeCaretBefore(editor, 'One')

    pressEnter(editor)
    editor.commands.insertContent('Before')

    expect(outline(editor)).toEqual([
      'quoteBlock: On Monday, Bob wrote:',
      'paragraph: Before',
      'quoteBlock: OneTwo'
    ])
    editor.destroy()
  })

  it('writes at the level of the message from a quote in the quote', () => {
    const editor = makeEditor(
      `<div data-html-block="quote">${CITE}<blockquote><p>Answer</p><blockquote><p>Older text</p></blockquote></blockquote></div>`
    )
    placeCaretAfter(editor, 'Older')

    pressEnter(editor)
    editor.commands.insertContent('Mine')

    expect(outline(editor)).toEqual([
      'quoteBlock: On Monday, Bob wrote:AnswerOlder',
      'paragraph: Mine',
      'quoteBlock:  text'
    ])
    // Both halves keep their two levels of quote
    const halves = editor.state.doc.content.content.filter(
      node => node.type.name === 'quoteBlock'
    )
    expect(halves[1]?.firstChild?.firstChild?.type.name).toBe('blockquote')
    editor.destroy()
  })

  it('writes at the level of the message from a quoted list', () => {
    const editor = makeEditor(
      `<div data-html-block="quote"><blockquote><ul><li><p>Item one</p></li><li><p>Item two</p></li></ul></blockquote></div>`
    )
    placeCaretAfter(editor, 'Item one')

    pressEnter(editor)

    expect(outline(editor)).toEqual([
      'quoteBlock: Item one',
      'paragraph: ',
      'quoteBlock: Item two'
    ])
    editor.destroy()
  })

  it('takes one step to undo', () => {
    const editor = makeEditor(quote('First line'))
    const before = editor.getHTML()
    placeCaretAfter(editor, 'First')

    pressEnter(editor)
    editor.commands.undo()

    expect(editor.getHTML()).toBe(before)
    editor.destroy()
  })

  it('leaves Shift+Enter a line break in the quote', () => {
    const editor = makeEditor(quote('First line'))
    placeCaretAfter(editor, 'First')

    press(editor, 'Enter', true)

    expect(editor.getHTML()).toContain(
      '<blockquote><p>First<br> line</p></blockquote>'
    )
    editor.destroy()
  })

  it('leaves the cite line alone', () => {
    const editor = makeEditor(quote('One'))
    placeCaretAfter(editor, 'Monday')

    pressEnter(editor)

    // Still one quote: the line is cut where it is
    expect(outline(editor).map(line => line.split(':')[0])).toEqual([
      'quoteBlock'
    ])
    editor.destroy()
  })

  it('leaves a quote the user writes alone: Enter adds a line in it', () => {
    const editor = makeEditor('<blockquote><p>A saying</p></blockquote>')
    placeCaretAfter(editor, 'A saying')

    pressEnter(editor)
    editor.commands.insertContent('More')

    expect(editor.getHTML()).toBe(
      '<blockquote><p>A saying</p><p>More</p></blockquote>'
    )
    editor.destroy()
  })

  it('replaces a selection as Enter does elsewhere', () => {
    const editor = makeEditor(quote('First line'))
    placeCaretAfter(editor, 'First')
    const { from } = editor.state.selection
    editor.commands.setTextSelection({ from: from - 5, to: from })

    pressEnter(editor)

    // Not cut out of the quote: still one quote holding the two lines
    expect(outline(editor).map(line => line.split(':')[0])).toEqual([
      'quoteBlock'
    ])
    editor.destroy()
  })
})
