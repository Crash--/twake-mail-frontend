// Upstream to twake-ui: with RichTextEditor. Images pasted inside HTML as
// `data:` URLs (a copied signature, a page) go through the caller's store,
// as the image files pasted or dropped do: tmail-flutter publishes them
// (`onPasteImageSuccess` in its identity creator).
import { Extension, type AnyExtension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { RefObject } from 'react'

import type { InlineImageAttributes } from './inlineImage'
import type { EditorActions } from './types'

type StoreImages = (files: File[]) => Promise<InlineImageAttributes[]>

const DATA_URL = /^data:([^;,]+)((?:;[^;,]*)*?)(;base64)?,(.*)$/s

/** The file a `data:` URL holds; null when it is not one, or not readable */
export function fileFromDataUrl(url: string, name: string): File | null {
  const match = DATA_URL.exec(url)
  if (!match) return null
  const [, type = '', , base64, data = ''] = match
  try {
    const text = base64 ? atob(data) : decodeURIComponent(data)
    const bytes = Uint8Array.from(text, character => character.charCodeAt(0))
    const extension = type.split('/')[1]?.split('+')[0] ?? 'bin'
    return new File([bytes], `${name}.${extension}`, { type })
  } catch {
    return null
  }
}

/**
 * Sends the `data:` images of the document of the accepted types to the
 * store, and puts what it gives in their place; the ones it does not take
 * are removed (it says why).
 */
export async function storeDataImages(
  editor: Editor,
  store: StoreImages,
  types: readonly string[]
): Promise<void> {
  const sources: string[] = []
  editor.state.doc.descendants(node => {
    const src = String(node.attrs.src ?? '')
    if (
      node.type.name === 'image' &&
      src.startsWith('data:') &&
      !sources.includes(src)
    ) {
      sources.push(src)
    }
  })
  for (const [index, src] of sources.entries()) {
    const file = fileFromDataUrl(src, `image-${index + 1}`)
    if (!file || !types.includes(file.type)) continue
    const [stored] = await store([file])
    if (editor.isDestroyed) return
    const { tr } = editor.state
    const found: {
      pos: number
      size: number
      attrs: Record<string, unknown>
    }[] = []
    tr.doc.descendants((node, pos) => {
      if (node.type.name === 'image' && node.attrs.src === src) {
        found.push({ pos, size: node.nodeSize, attrs: node.attrs })
      }
    })
    // From the end: the positions before stay valid
    for (const { pos, size, attrs } of found.reverse()) {
      if (stored) {
        tr.setNodeMarkup(pos, undefined, {
          ...attrs,
          src: stored.src,
          reference: stored.reference,
          alt: attrs.alt ?? stored.alt
        })
      } else {
        tr.delete(pos, pos + size)
      }
    }
    if (found.length > 0) editor.view.dispatch(tr)
  }
}

/** Stores the `data:` images of each paste once it is in the document */
export function createPastedDataImages(
  actionsRef: RefObject<EditorActions>,
  types: readonly string[]
): AnyExtension {
  return Extension.create({
    name: 'pastedDataImages',
    addProseMirrorPlugins() {
      const { editor } = this
      return [
        new Plugin({
          key: new PluginKey('pastedDataImages'),
          props: {
            handlePaste: () => {
              // The paste is applied right after this handler returns
              setTimeout(() => {
                const store = actionsRef.current.storeImages
                if (!store || editor.isDestroyed) return
                storeDataImages(editor, store, types).catch((error: unknown) =>
                  console.error(error)
                )
              })
              return false
            }
          }
        })
      ]
    }
  })
}
