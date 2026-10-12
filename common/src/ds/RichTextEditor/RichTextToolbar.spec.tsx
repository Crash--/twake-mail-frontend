import { act, screen, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/core'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { RichTextEditor, type RichTextEditorProps } from './RichTextEditor'
import type { RichTextEditorLabels } from './types'

const LABELS: RichTextEditorLabels = {
  editor: 'Message body',
  keyboardHelp: 'Help',
  toolbar: 'Formatting options',
  undo: 'Undo',
  redo: 'Redo',
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strike: 'Strikethrough',
  textColor: 'Text color',
  highlight: 'Highlight color',
  fontSize: 'Text size',
  fontFamily: 'Font',
  textStyle: 'Text style',
  textStyles: {
    paragraph: 'Normal',
    h1: 'Header 1',
    h2: 'Header 2',
    h3: 'Header 3',
    h4: 'Header 4',
    h5: 'Header 5',
    h6: 'Header 6',
    blockquote: 'Quote',
    code: 'Code'
  },
  lists: 'Lists and indentation',
  indent: 'Increase indent',
  outdent: 'Decrease indent',
  customColor: 'Other color',
  noHighlight: 'No highlight',
  align: 'Paragraph',
  alignments: {
    left: 'Align left',
    center: 'Align center',
    right: 'Align right',
    justify: 'Justify'
  },
  bulletList: 'Bulleted list',
  orderedList: 'Numbered list',
  blockquote: 'Quote',
  link: 'Insert link',
  insertImage: 'Insert image',
  clearFormatting: 'Clear formatting',
  linkDialog: {
    title: 'Insert link',
    text: 'Text',
    url: 'URL',
    apply: 'Apply',
    cancel: 'Cancel',
    remove: 'Remove link'
  },
  image: {
    toolbar: 'Image options',
    sizes: { small: '', medium: '', large: '', original: '' },
    smaller: '',
    larger: '',
    remove: '',
    sizeStatus: () => '',
    alt: '',
    altHelp: ''
  }
}

async function renderEditor(
  content = '<p>Hello</p>',
  props: Partial<RichTextEditorProps> = {}
): Promise<Editor> {
  const created: { editor: Editor | null } = { editor: null }
  renderDs(
    <RichTextEditor
      labels={LABELS}
      content={content}
      colors={[
        { value: null, label: 'Default color' },
        { value: '#ff4d4d', label: 'Red' },
        { value: '#0a84ff', label: 'Blue' }
      ]}
      fontSizes={[
        { value: '12px', label: '12' },
        { value: '14px', label: '14' },
        { value: '24px', label: '24' }
      ]}
      fontFamilies={[
        { value: 'sans-serif', label: 'Sans Serif' },
        { value: 'Times New Roman', label: 'Times New Roman' }
      ]}
      onReady={editor => {
        created.editor = editor
      }}
      {...props}
    />
  )
  await screen.findByRole('textbox', { name: 'Message body' })
  if (created.editor === null) throw new Error('The editor was not created')
  const { editor } = created
  act(() => {
    editor.commands.selectAll()
  })
  return editor
}

async function choose(button: string, item: string): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: button }))
  const menu = await screen.findByRole('menu')
  await userEvent.click(within(menu).getByText(item))
}

describe('RichTextToolbar controls', () => {
  it('has the buttons of the composer of tmail-flutter, its text styles in its order', async () => {
    await renderEditor()

    // Ctrl+Z and Ctrl+Y undo and redo: no button, nor clearing, as
    // tmail-flutter
    expect(screen.queryByRole('button', { name: 'Undo' })).toBe(null)
    expect(screen.queryByRole('button', { name: 'Redo' })).toBe(null)
    expect(screen.queryByRole('button', { name: 'Clear formatting' })).toBe(
      null
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Text style Normal' })
    )
    const styles = within(await screen.findByRole('menu'))
      .getAllByRole('menuitemradio')
      .map(item => item.textContent)
    expect(styles.slice(0, 4)).toEqual(['Normal', 'Quote', 'Code', 'Header 1'])
  })

  it('applies a text style from the "Aa" menu and says which one is current', async () => {
    const editor = await renderEditor()

    await choose('Text style Normal', 'Header 2')
    expect(editor.getHTML()).toBe('<h2>Hello</h2>')
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Text style Header 2' })
      ).toBeInTheDocument()
    })

    await choose('Text style Header 2', 'Quote')
    expect(editor.getHTML()).toContain('<blockquote>')
    await choose('Text style Quote', 'Code')
    expect(editor.getHTML()).toBe('<pre><code>Hello</code></pre>')
    await choose('Text style Code', 'Normal')
    expect(editor.getHTML()).toBe('<p>Hello</p>')
  })

  it('writes the font size and font family as inline styles and shows them', async () => {
    const editor = await renderEditor()

    await choose('Text size 14', '24')
    expect(editor.getHTML()).toContain('font-size: 24px')
    await choose('Font Sans Serif', 'Times New Roman')
    expect(editor.getHTML()).toContain('font-family: Times New Roman')
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Font Times New Roman' })
      ).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Text size 24' })).toBeVisible()
  })

  it('picks a text colour and a highlight in a popover, and resets them', async () => {
    const editor = await renderEditor()

    await userEvent.click(screen.getByRole('button', { name: 'Text color' }))
    const colors = await screen.findByRole('dialog', { name: 'Text color' })
    await userEvent.click(within(colors).getByRole('radio', { name: 'Red' }))
    expect(editor.getHTML()).toMatch(/color: (#ff4d4d|rgb\(255, 77, 77\))/)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Highlight color' })
    )
    const highlights = await screen.findByRole('dialog', {
      name: 'Highlight color'
    })
    await userEvent.click(
      within(highlights).getByRole('radio', { name: 'Blue' })
    )
    expect(editor.getHTML()).toMatch(
      /background-color: (#0a84ff|rgb\(10, 132, 255\))/
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Highlight color' })
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'No highlight' })
    )
    expect(editor.getHTML()).not.toContain('background-color')
  })

  it('aligns, makes lists and indents', async () => {
    const editor = await renderEditor()

    await choose('Paragraph', 'Align center')
    expect(editor.getHTML()).toContain('text-align: center')
    await choose('Lists and indentation', 'Increase indent')
    expect(editor.getHTML()).toContain('margin-left: 24px')
    await choose('Lists and indentation', 'Decrease indent')
    expect(editor.getHTML()).not.toContain('margin-left')
    await choose('Lists and indentation', 'Bulleted list')
    expect(editor.getHTML()).toContain('<ul>')
    await choose('Lists and indentation', 'Numbered list')
    expect(editor.getHTML()).toContain('<ol>')
  })

  it('moves in the menu with the arrows and closes it with Escape', async () => {
    await renderEditor()
    const button = screen.getByRole('button', { name: 'Text style Normal' })

    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBe(null)
    })
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('has the buttons of tmail-flutter in its boxed look, the image first', async () => {
    await renderEditor('<p>Hello</p>', {
      look: 'boxed',
      onImageFiles: () => Promise.resolve([])
    })

    const names = within(
      screen.getByRole('toolbar', { name: 'Formatting options' })
    )
      .getAllByRole('button')
      .map(button => button.getAttribute('aria-label'))
    expect(names).toEqual([
      'Insert image',
      'Text style Normal',
      // tmail-flutter's signature is written in 16 px
      'Text size 16',
      'Font Sans Serif',
      'Text color',
      'Highlight color',
      'Bold',
      'Italic',
      'Underline',
      'Strikethrough',
      'Paragraph',
      'Lists and indentation'
    ])
  })
})
