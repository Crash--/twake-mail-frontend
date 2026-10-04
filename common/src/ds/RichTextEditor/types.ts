import type { InlineImageAttributes } from './inlineImage'

/** A colour of the text colour menu; `value: null` resets to the default */
export interface RichTextColor {
  value: string | null
  label: string
}

/** A size of the font size menu (`14px`…); `value: null` resets */
export interface RichTextFontSize {
  value: string | null
  label: string
}

export interface RichTextLinkDialogLabels {
  title: string
  text: string
  url: string
  apply: string
  cancel: string
  remove: string
}

/** Every string of the editor, translated by the caller */
export interface RichTextEditorLabels {
  /** Accessible name of the editing area */
  editor: string
  /** Keyboard help, read after the name (`aria-describedby`) */
  keyboardHelp: string
  toolbar: string
  undo: string
  redo: string
  bold: string
  italic: string
  underline: string
  strike: string
  textColor: string
  fontSize: string
  align: string
  alignments: Record<'left' | 'center' | 'right' | 'justify', string>
  bulletList: string
  orderedList: string
  blockquote: string
  link: string
  insertImage: string
  clearFormatting: string
  linkDialog: RichTextLinkDialogLabels
}

/** The buttons of the formatting toolbar */
export type RichTextToolbarItemId =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'color'
  | 'size'
  | 'align'
  | 'bullet-list'
  | 'ordered-list'
  | 'blockquote'
  | 'link'
  | 'image'
  | 'clear-formatting'

/**
 * The `data-testid` of the editor's parts, chosen by the caller (they are a
 * contract of the app with its end-to-end tests). A part without one gets
 * none.
 */
export interface RichTextEditorTestIds {
  /** The editing area */
  editor?: string
  toolbarButton?: (item: RichTextToolbarItemId) => string
  linkTextInput?: string
  linkUrlInput?: string
  linkApplyButton?: string
}

/** What the editor's extensions call back, kept current by the component */
export interface EditorActions {
  openLinkDialog: () => void
  focusToolbar: () => void
  storeImages: ((files: File[]) => Promise<InlineImageAttributes[]>) | null
}
