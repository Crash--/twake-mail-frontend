import { Extension, type AnyExtension } from '@tiptap/core'

/**
 * Approach (a) of the spike: the quoted email parsed into the editor
 * schema, with tables and the inline `style` (and the old presentational
 * attributes) kept on the nodes that have them. ProseMirror still drops
 * every element its schema does not know (div, span without a known style,
 * center, font, h1…) and normalizes the rest.
 */
const STYLED_NODES = [
  'paragraph',
  'blockquote',
  'bulletList',
  'orderedList',
  'listItem',
  'table',
  'tableRow',
  'tableCell',
  'tableHeader',
  'image'
]

function keptAttribute(name: string): {
  default: null
  parseHTML: (element: HTMLElement) => string | null
  renderHTML: (attributes: Record<string, unknown>) => Record<string, string>
} {
  return {
    default: null,
    parseHTML: element => element.getAttribute(name),
    renderHTML: attributes => {
      const value = attributes[name]
      return typeof value === 'string' ? { [name]: value } : {}
    }
  }
}

const KeepPresentation = Extension.create({
  name: 'keepPresentation',
  addGlobalAttributes() {
    return [
      {
        types: STYLED_NODES,
        attributes: {
          style: keptAttribute('style'),
          width: keptAttribute('width'),
          bgcolor: keptAttribute('bgcolor'),
          align: keptAttribute('align'),
          valign: keptAttribute('valign')
        }
      }
    ]
  }
})

/** The editor has tables already (RichTextEditor) */
export function schemaQuoteExtensions(): AnyExtension[] {
  return [KeepPresentation]
}
