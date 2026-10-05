import type { Editor } from '@tiptap/core'

/**
 * Loads the images of the editor kept without their source
 * (`data-blocked-src`, see `blockRemoteImages`), in one undoable step
 */
export function showBlockedImages(editor: Editor): void {
  const { tr, doc } = editor.state
  doc.descendants((node, position) => {
    const blocked: unknown = node.attrs.blockedSrc
    if (node.type.name !== 'image' || typeof blocked !== 'string') return
    tr.setNodeMarkup(position, undefined, {
      ...node.attrs,
      src: blocked,
      blockedSrc: null
    })
  })
  if (tr.docChanged) editor.view.dispatch(tr)
}
