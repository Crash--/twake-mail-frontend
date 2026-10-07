import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import userEvent from '@testing-library/user-event'
import { useState, type KeyboardEvent, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { RichTextEditor } from './RichTextEditor'
import type { RichTextEditorActions, RichTextEditorLabels } from './types'

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
  highlight: 'Highlight color',
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
    sizeStatus: (width, percent) => `Width ${width} px, ${percent}%`,
    alt: 'Alternative text',
    altHelp: 'Leave empty if decorative.'
  }
}

const FONTS = [
  { value: 'sans-serif', label: 'Sans Serif' },
  { value: 'Arial', label: 'Arial' }
]

const TEST_IDS = {
  editor: 'editor',
  toolbarButton: (item: string) => `toolbar-${item}`,
  linkUrlInput: 'link-url',
  imageToolbar: 'image-toolbar',
  imageAltInput: 'image-alt',
  imageButton: (item: string) => `image-${item}`
}

async function renderEditor(
  content = '<p>Hello</p>',
  onEscape?: () => void
): Promise<Editor> {
  const created: { editor: Editor | null } = { editor: null }
  renderDs(
    // Where the window around the editor would see an Escape that goes up
    <div
      role="presentation"
      onKeyDown={event => {
        if (event.key === 'Escape') onEscape?.()
      }}
    >
      <RichTextEditor
        labels={LABELS}
        content={content}
        colors={[{ value: null, label: 'Default' }]}
        fontSizes={[{ value: null, label: 'Normal' }]}
        fontFamilies={FONTS}
        testIds={TEST_IDS}
        onReady={editor => {
          created.editor = editor
        }}
      />
    </div>
  )
  await screen.findByRole('textbox', { name: 'Message body' })
  if (created.editor === null) throw new Error('The editor was not created')
  return created.editor
}

function DisabledEditor({
  onReady
}: {
  onReady: (editor: Editor) => void
}): ReactElement {
  const [disabled, setDisabled] = useState(true)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDisabled(false)
        }}
      >
        Enable
      </button>
      <RichTextEditor
        labels={LABELS}
        content="<p>Away until Monday</p>"
        colors={[{ value: null, label: 'Default' }]}
        fontSizes={[{ value: null, label: 'Normal' }]}
        fontFamilies={FONTS}
        testIds={TEST_IDS}
        disabled={disabled}
        onReady={onReady}
      />
    </>
  )
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

    screen.getByRole('button', { name: 'Text style Normal' }).focus()
    await userEvent.keyboard('{ArrowRight>5/}')
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
          fontFamilies={FONTS}
        />
      </div>
    )
    const text = await screen.findByRole('textbox', { name: 'Message body' })
    act(() => {
      text.focus()
    })

    await userEvent.keyboard('{Alt>}{F10}{/Alt}')
    expect(
      screen.getByRole('button', { name: 'Text style Normal' })
    ).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(text).toHaveFocus()
    })
    expect(handleEscape).not.toHaveBeenCalled()

    await userEvent.keyboard('{Escape}')
    expect(handleEscape).toHaveBeenCalledTimes(1)
  })

  it('puts a caret left between the blocks (a tap on a quote in WebKit) in the paragraph above', async () => {
    const editor = await renderEditor(
      '<p></p><p></p><div data-html-block="quote"><blockquote>Hi</blockquote></div>'
    )
    const { view } = editor
    // The end of the second paragraph, where ProseMirror maps the caret
    // between it and the quote: already selected, it leaves the DOM alone.
    // view.focus() focuses now, the focus command only on the next frame
    act(() => {
      editor.commands.setTextSelection(3)
      view.focus()
    })
    const domSelection = document.getSelection()

    act(() => {
      domSelection?.collapse(view.dom, 2)
      document.dispatchEvent(new Event('selectionchange'))
    })

    expect(editor.state.selection).toBeInstanceOf(TextSelection)
    expect(editor.state.selection.head).toBe(3)
    expect(domSelection?.anchorNode).toBe(view.dom.children[1])
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

    describe('alternative text', () => {
      const bodyBox = (): HTMLElement =>
        screen.getByRole('textbox', { name: 'Message body' })

      it('is a labelled field with the text of the image, and a help', async () => {
        await selectImage()
        const field = await screen.findByRole('textbox', {
          name: 'Alternative text'
        })

        expect(field).toHaveValue('Picture')
        expect(field).toHaveAttribute('data-testid', 'image-alt')
        expect(field).toHaveAccessibleDescription('Leave empty if decorative.')
      })

      it('is reached with Tab from the toolbar, and written with Enter', async () => {
        const editor = await selectImage()
        const small = await screen.findByRole('button', { name: '25%' })
        act(() => {
          small.focus()
        })

        await userEvent.keyboard('{Tab}')
        const field = screen.getByRole('textbox', { name: 'Alternative text' })
        expect(field).toHaveFocus()
        await userEvent.clear(field)
        await userEvent.type(field, 'A red bicycle')
        // Nothing is written while it is typed
        expect(editor.getHTML()).toContain('alt="Picture"')

        await userEvent.keyboard('{Enter}')
        expect(editor.getHTML()).toContain('alt="A red bicycle"')
        await waitFor(() => {
          expect(bodyBox()).toHaveFocus()
        })
        expect(editor.state.selection).toBeInstanceOf(NodeSelection)
      })

      it('makes the image decorative when emptied: alt="" is kept', async () => {
        const editor = await selectImage()
        const field = await screen.findByRole('textbox', {
          name: 'Alternative text'
        })
        await userEvent.clear(field)
        await userEvent.keyboard('{Enter}')

        expect(editor.getHTML()).toContain('alt=""')
      })

      it('gives the old text back on Escape, and keeps Escape from the window', async () => {
        const handleEscape = jest.fn()
        const editor = await renderEditor(
          '<p>Look <img src="blob:picture" alt="Picture"> here</p>',
          handleEscape
        )
        act(() => {
          bodyBox().focus()
          editor.view.dispatch(
            editor.state.tr.setSelection(
              NodeSelection.create(editor.state.doc, 6)
            )
          )
        })
        const field = await screen.findByRole('textbox', {
          name: 'Alternative text'
        })
        await userEvent.clear(field)
        await userEvent.type(field, 'Draft')

        await userEvent.keyboard('{Escape}')
        expect(editor.getHTML()).toContain('alt="Picture"')
        expect(handleEscape).not.toHaveBeenCalled()
        await waitFor(() => {
          expect(bodyBox()).toHaveFocus()
        })
      })

      it('goes back to the toolbar with Shift+Tab, writing the text', async () => {
        const editor = await selectImage()
        const field = await screen.findByRole('textbox', {
          name: 'Alternative text'
        })
        act(() => {
          field.focus()
        })
        await userEvent.type(field, ' 2')

        await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
        expect(editor.getHTML()).toContain('alt="Picture 2"')
        await waitFor(() => {
          expect(screen.getByRole('button', { name: '25%' })).toHaveFocus()
        })
      })
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

  it('is disabled on demand, its content kept for when it is enabled again', async () => {
    const created: { editor: Editor | null } = { editor: null }
    const handleReady = (editor: Editor): void => {
      created.editor = editor
    }
    renderDs(<DisabledEditor onReady={handleReady} />)
    const area = await screen.findByRole('textbox', { name: 'Message body' })

    expect(area).toHaveAttribute('aria-disabled', 'true')
    expect(area).toHaveAttribute('contenteditable', 'false')
    const bold = screen.getByTestId('toolbar-bold')
    expect(bold).toHaveAttribute('aria-disabled', 'true')
    // Still in the tab order of the toolbar
    expect(bold.tabIndex).toBe(-1)
    expect(screen.getByTestId('toolbar-text-style').tabIndex).toBe(0)
    await userEvent.click(bold)
    expect(created.editor?.getHTML()).toBe('<p>Away until Monday</p>')

    await userEvent.click(screen.getByRole('button', { name: 'Enable' }))

    await waitFor(() => {
      expect(area).toHaveAttribute('contenteditable', 'true')
    })
    expect(area).not.toHaveAttribute('aria-disabled')
    expect(bold).not.toHaveAttribute('aria-disabled')
    expect(area).toHaveTextContent('Away until Monday')
  })

  it('shows the size and the colour in the toolbar, and groups the toggles', async () => {
    await renderEditor('<p><span style="font-size: 18px">Big</span></p>')
    const toolbar = await screen.findByRole('toolbar', {
      name: 'Formatting options'
    })
    expect(
      within(toolbar).getByRole('button', { name: 'Text size 18' })
    ).toHaveTextContent('18')
    // Bold, italic, underline and strikethrough share one box
    const bold = within(toolbar).getByRole('button', { name: 'Bold' })
    const strike = within(toolbar).getByRole('button', {
      name: 'Strikethrough'
    })
    expect(bold.parentElement).toBe(strike.parentElement)
    expect(bold.parentElement).not.toBe(toolbar)
  })

  it('leaves the link and image buttons to its parent, who opens them', async () => {
    const handle: { current: RichTextEditorActions | null } = { current: null }
    renderDs(
      <RichTextEditor
        labels={LABELS}
        content="<p>Hello</p>"
        colors={[{ value: null, label: 'Default' }]}
        fontSizes={[{ value: null, label: 'Normal' }]}
        fontFamilies={FONTS}
        onImageFiles={() => Promise.resolve([])}
        hasInsertButtons={false}
        isToolbarBelow
        actions={handle}
      />
    )
    await screen.findByRole('textbox', { name: 'Message body' })
    expect(screen.queryByRole('button', { name: 'Insert link' })).toBe(null)
    expect(screen.queryByRole('button', { name: 'Insert image' })).toBe(null)

    act(() => {
      handle.current?.openLinkDialog()
    })
    expect(
      await screen.findByRole('dialog', { name: 'Insert link' })
    ).toBeVisible()
  })

  it('hides the toolbar on demand', async () => {
    renderDs(
      <RichTextEditor
        labels={LABELS}
        content="<p>Hello</p>"
        colors={[{ value: null, label: 'Default' }]}
        fontSizes={[{ value: null, label: 'Normal' }]}
        fontFamilies={FONTS}
        isToolbarShown={false}
      />
    )
    await screen.findByRole('textbox', { name: 'Message body' })
    expect(screen.queryByRole('toolbar')).toBe(null)
  })
})
