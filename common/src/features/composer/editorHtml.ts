import type { Editor } from '@tiptap/core'
import { DOMSerializer, type Node as ProseMirrorNode } from '@tiptap/pm/model'

import { toStorageHtml } from './emailHtml'

/**
 * The HTML of the editor, as `editor.getHTML()` writes it, but made block by block: a
 * ProseMirror document is immutable and shares the blocks a transaction did not touch, so
 * the HTML of each top level block is kept against the block itself. Typing in a 2 MB draft
 * serializes one paragraph instead of the whole document (about 30 ms at full speed, 110 ms
 * with the CPU slowed 4 times, each time the form reads the message: saves, fingerprints).
 */
const blockHtml = new WeakMap<ProseMirrorNode, string>()
const serializers = new WeakMap<object, DOMSerializer>()
/** Like tiptap, a document of its own: an image serialized must not start loading in the page */
let scratch: Document | null = null

function serializerOf(editor: Editor): DOMSerializer {
  let serializer = serializers.get(editor.schema)
  if (serializer === undefined) {
    serializer = DOMSerializer.fromSchema(editor.schema)
    serializers.set(editor.schema, serializer)
  }
  return serializer
}

export function getEditorHtml(editor: Editor): string {
  const serializer = serializerOf(editor)
  scratch ??= document.implementation.createHTMLDocument()
  const container = scratch.createElement('div')
  const parts: string[] = []
  editor.state.doc.forEach(block => {
    let html = blockHtml.get(block)
    if (html === undefined) {
      container.replaceChildren(
        serializer.serializeNode(block, { document: scratch ?? document })
      )
      html = container.innerHTML
      blockHtml.set(block, html)
    }
    parts.push(html)
  })
  return parts.join('')
}

const storageHtml = new WeakMap<ProseMirrorNode, string>()

/** `toStorageHtml(editor.getHTML())`, kept against the document it was made from */
export function getEditorStorageHtml(editor: Editor): string {
  const doc = editor.state.doc
  let html = storageHtml.get(doc)
  if (html === undefined) {
    html = toStorageHtml(getEditorHtml(editor))
    storageHtml.set(doc, html)
  }
  return html
}
