// Upstream to twake-ui: with RichTextEditor.
import Image from '@tiptap/extension-image'

/** What the editor needs to show an image and find it again at export time */
export interface InlineImageAttributes {
  /** What the browser displays: an object URL while composing */
  src: string
  alt: string | null
  /** Opaque reference the caller maps back to its stored file (a Content-ID for emails) */
  reference: string | null
  width: number | null
}

/**
 * The Image extension, inline in the text flow, with a `data-reference`
 * attribute that survives `getHTML()` and parsing: the caller swaps `src`
 * for its own URL scheme (`cid:`) on export, and back on load.
 */
export const InlineImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      reference: {
        default: null,
        parseHTML: element => element.getAttribute('data-reference'),
        renderHTML: attributes =>
          attributes.reference
            ? { 'data-reference': String(attributes.reference) }
            : {}
      }
    }
  }
}).configure({
  inline: true,
  allowBase64: true,
  resize: {
    enabled: true,
    directions: ['bottom-right', 'bottom-left'],
    minWidth: 40,
    minHeight: 40,
    alwaysPreserveAspectRatio: true
  }
})
