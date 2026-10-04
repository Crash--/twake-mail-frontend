import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import userEvent from '@testing-library/user-event'
import type { KeyboardEvent } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { RichTextEditor } from './RichTextEditor'
import type { RichTextEditorLabels } from './types'

const LABELS: RichTextEditorLabels = {
  editor: 'Message body',
  keyboardHelp: 'Alt+F10 goes to the toolbar',
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
  },
  image: {
    toolbar: 'Image options',
    sizes: {
      small: '25%',
      medium: '50%',
      large: '75%',
      original: 'Original size'
    },
    smaller: 'Smaller',
    larger: 'Larger',
    remove: 'Remove image',
    sizeStatus: (width, percent) => `Width ${width} px, ${percent}%`
  }
}

const TEST_IDS = {
  editor: 'editor',
  toolbarButton: (item: string) => `toolbar-${item}`,
  linkUrlInput: 'link-url',
  imageToolbar: 'image-toolbar',
  imageButton: (item: string) => `image-${item}`
}

async function renderEditor(content = '<p>Hello</p>'): Promise<Editor> {
  const created: { editor: Editor | null } = { editor: null }
  renderDs(
    <RichTextEditor
      labels={LABELS}
      content={content}
      colors={[{ value: null, label: 'Default' }]}
      fontSizes={[{ value: null, label: 'Normal' }]}
      testIds={TEST_IDS}
      onReady={editor => {
        created.editor = editor
      }}
    />
  )
  await screen.findByRole('textbox', { name: 'Message body' })
  if (created.editor === null) throw new Error('The editor was not created')
  return created.editor
}

const IMAGE_WIDTH = 800
const IMAGE_HEIGHT = 400

describe('RichTextEditor', () => {
  it('is a named multiline textbox described by its keyboard help', async () => {
    await renderEditor()
    const editor = screen.getByRole('textbox', { name: 'Message body' })

    expect(editor).toHaveAttribute('aria-multiline', 'true')
    expect(editor).toHaveAccessibleDescription('Alt+F10 goes to the toolbar')
    expect(editor).toHaveAttribute('data-testid', 'editor')
    expect(editor).toHaveTextContent('Hello')
  })

  it('has a toolbar with one tab stop, arrows moving between named buttons', async () => {
    await renderEditor()
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
    await renderEditor('<p><strong>Bold text</strong></p>')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    })
  })

  it('goes to the toolbar with Alt+F10 and leaves Escape in the text to its container', async () => {
    const handleEscape = jest.fn()
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
      if (event.key === 'Escape') handleEscape()
    }
    renderDs(
      <div role="presentation" onKeyDown={handleKeyDown}>
        <RichTextEditor
          labels={LABELS}
          content="<p>Hello</p>"
          colors={[{ value: null, label: 'Default' }]}
          fontSizes={[{ value: null, label: 'Normal' }]}
        />
      </div>
    )
    const text = await screen.findByRole('textbox', { name: 'Message body' })
    act(() => {
      text.focus()
    })

    await userEvent.keyboard('{Alt>}{F10}{/Alt}')
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(text).toHaveFocus()
    })
    expect(handleEscape).not.toHaveBeenCalled()

    await userEvent.keyboard('{Escape}')
    expect(handleEscape).toHaveBeenCalledTimes(1)
  })

  describe('image toolbar', () => {
    beforeEach(() => {
      jest
        .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
        .mockReturnValue(IMAGE_WIDTH)
      jest
        .spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get')
        .mockReturnValue(IMAGE_HEIGHT)
    })

    async function selectImage(): Promise<Editor> {
      const editor = await renderEditor(
        '<p>Look <img src="blob:picture" alt="Picture"> here</p>'
      )
      act(() => {
        screen.getByRole('textbox', { name: 'Message body' }).focus()
        // "Look " is 5 characters, after the paragraph opening
        editor.view.dispatch(
          editor.state.tr.setSelection(
            NodeSelection.create(editor.state.doc, 6)
          )
        )
      })
      return editor
    }

    it('shows the size of the selected image and opens with Enter', async () => {
      await selectImage()
      const toolbar = await screen.findByRole('toolbar', {
        name: 'Image options'
      })

      expect(toolbar).toHaveAttribute('data-testid', 'image-toolbar')
      expect(screen.getByRole('status')).toHaveTextContent('Width 800 px, 100%')
      expect(
        screen.getByRole('button', { name: 'Original size' })
      ).toHaveAttribute('aria-pressed', 'true')

      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Message body' }), {
        key: 'Enter'
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '25%' })).toHaveFocus()
      })
    })

    it('resizes the image with the keyboard, keeping its proportions', async () => {
      const editor = await selectImage()
      const small = await screen.findByRole('button', { name: '25%' })
      act(() => {
        small.focus()
      })

      await userEvent.keyboard('{Enter}')
      expect(editor.getHTML()).toContain('width="200" height="100"')
      expect(screen.getByRole('status')).toHaveTextContent('Width 200 px, 25%')
      expect(small).toHaveAttribute('aria-pressed', 'true')

      await userEvent.keyboard('{End}{ArrowLeft}{ArrowLeft}')
      expect(screen.getByRole('button', { name: 'Smaller' })).toHaveFocus()
      await userEvent.keyboard('{ArrowRight}{Enter}')
      expect(editor.getHTML()).toContain('width="280" height="140"')

      await userEvent.keyboard('{Escape}')
      await waitFor(() => {
        expect(
          screen.getByRole('textbox', { name: 'Message body' })
        ).toHaveFocus()
      })
      expect(editor.state.selection).toBeInstanceOf(NodeSelection)
    })

    it('removes the image', async () => {
      const editor = await selectImage()
      const remove = await screen.findByRole('button', {
        name: 'Remove image'
      })
      expect(remove).toHaveAttribute('data-testid', 'image-remove')

      await userEvent.click(remove)
      expect(editor.getHTML()).not.toContain('<img')
      expect(screen.queryByRole('toolbar', { name: 'Image options' })).toBe(
        null
      )
    })
  })
})
