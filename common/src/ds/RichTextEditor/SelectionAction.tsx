// Upstream to twake-ui: with RichTextEditor. A button that follows the
// selected text (the "assist" sparkle of a writing assistant); what it does
// is the parent's.
import { IconButton, Tooltip } from '@linagora/twake-mui'
import { useEditorState, type Editor } from '@tiptap/react'
import { useLayoutEffect, useState, type ReactElement } from 'react'

import type { RichTextSelectionAction } from './types'

interface Position {
  top: number
  left: number
}

export interface SelectionActionProps {
  editor: Editor
  action: RichTextSelectionAction
  /** The element the button is placed in (relative) */
  container: HTMLElement | null
}

/**
 * A button under the end of the selected text, shown while some text is
 * selected. It follows the selection and the scrolling; in the tab order
 * after the text, so a keyboard user reaches it too.
 */
export function SelectionAction({
  editor,
  action,
  container
}: SelectionActionProps): ReactElement | null {
  const selection = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      from: current.state.selection.from,
      to: current.state.selection.to,
      isEmpty: current.state.selection.empty
    })
  })
  const [position, setPosition] = useState<Position | null>(null)

  useLayoutEffect(() => {
    if (selection.isEmpty || container === null || editor.isDestroyed) {
      return undefined
    }
    // The window the editor is rendered in, maybe not this one
    const view = container.ownerDocument.defaultView ?? window
    const place = (): void => {
      try {
        // The last box of the selected text, as the eye sees it; a select
        // all would otherwise end after the last block, at the far side
        const domSelection = view.getSelection()
        const boxes =
          domSelection !== null && domSelection.rangeCount > 0
            ? Array.from(domSelection.getRangeAt(0).getClientRects()).filter(
                box => box.width > 0 && box.height > 0
              )
            : []
        const end = boxes.at(-1) ?? editor.view.coordsAtPos(selection.to)
        const frame = container.getBoundingClientRect()
        setPosition({
          top: end.bottom - frame.top + 4,
          left: end.right - frame.left
        })
      } catch {
        setPosition(null)
      }
    }
    place()
    view.addEventListener('scroll', place, true)
    view.addEventListener('resize', place)
    return () => {
      view.removeEventListener('scroll', place, true)
      view.removeEventListener('resize', place)
    }
  }, [editor, container, selection.isEmpty, selection.to])

  if (selection.isEmpty || position === null) return null

  return (
    <Tooltip title={action.label}>
      <IconButton
        size="small"
        aria-label={action.label}
        aria-haspopup="true"
        onClick={event => {
          action.onSelect(event.currentTarget)
        }}
        // The click must not move the caret: the selection is what is used
        onMouseDown={event => {
          event.preventDefault()
        }}
        data-testid={action.testId}
        sx={{
          position: 'absolute',
          top: position.top,
          left: position.left,
          zIndex: 2,
          bgcolor: 'background.paper',
          boxShadow: 2,
          '&:hover': { bgcolor: 'background.paper' }
        }}
      >
        {action.icon}
      </IconButton>
    </Tooltip>
  )
}
