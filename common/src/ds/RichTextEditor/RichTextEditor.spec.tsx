import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { RichTextEditor } from './RichTextEditor'
import type { RichTextEditorLabels } from './types'

const LABELS: RichTextEditorLabels = {
  editor: 'Message body',
  keyboardHelp: 'Escape goes to the toolbar',
  toolbar: 'Formatting options',
  undo: 'Undo',
  redo: 'Redo',
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strike: 'Strikethrough',
  textColor: 'Text color',
  fontSize: 'Text size',
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
  }
}

function renderEditor(content = '<p>Hello</p>'): void {
  renderDs(
    <RichTextEditor
      labels={LABELS}
      content={content}
      colors={[{ value: null, label: 'Default' }]}
      fontSizes={[{ value: null, label: 'Normal' }]}
      testIds={{
        editor: 'editor',
        toolbarButton: item => `toolbar-${item}`
      }}
    />
  )
}

describe('RichTextEditor', () => {
  it('is a named multiline textbox described by its keyboard help', async () => {
    renderEditor()
    const editor = await screen.findByRole('textbox', { name: 'Message body' })

    expect(editor).toHaveAttribute('aria-multiline', 'true')
    expect(editor).toHaveAttribute('data-testid', 'editor')
    expect(editor).toHaveAccessibleDescription('Escape goes to the toolbar')
    expect(editor).toHaveTextContent('Hello')
  })

  it('has a toolbar with one tab stop, arrows moving between named buttons', async () => {
    renderEditor()
    const toolbar = await screen.findByRole('toolbar', {
      name: 'Formatting options'
    })
    const buttons = screen
      .getAllByRole('button')
      .filter(button => toolbar.contains(button))

    expect(buttons.filter(button => button.tabIndex === 0)).toHaveLength(1)
    expect(buttons.every(button => button.getAttribute('aria-label'))).toBe(
      true
    )
    const bold = screen.getByRole('button', { name: 'Bold' })
    expect(bold).toHaveAttribute('aria-pressed', 'false')
    expect(bold).toHaveAttribute('data-testid', 'toolbar-bold')
    // No image handler: no image button
    expect(screen.queryByRole('button', { name: 'Insert image' })).toBe(null)

    screen.getByRole('button', { name: 'Undo' }).focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(bold).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(
      screen.getByRole('button', { name: 'Clear formatting' })
    ).toHaveFocus()
  })

  it('says which formatting the selection has', async () => {
    renderEditor('<p><strong>Bold text</strong></p>')
    await screen.findByRole('textbox', { name: 'Message body' })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    })
  })
})
