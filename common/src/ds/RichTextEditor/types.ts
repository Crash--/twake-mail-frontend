import type { InlineImageAttributes } from './inlineImage'

/** The size of the text, in px, when the user chose none */
export const DEFAULT_FONT_SIZE = 14

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

/** The image sizes the image toolbar offers, in % of the image's own width */
export const IMAGE_SIZE_PRESETS = {
  small: 25,
  medium: 50,
  large: 75,
  original: 100
} as const

export type ImageSizePreset = keyof typeof IMAGE_SIZE_PRESETS

export interface RichTextImageLabels {
  /** Name of the image toolbar */
  toolbar: string
  sizes: Record<ImageSizePreset, string>
  smaller: string
  larger: string
  remove: string
  /** What the status line says of the current size */
  sizeStatus: (width: number, percent: number) => string
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
  image: RichTextImageLabels
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

/** The buttons of the image toolbar */
export type RichTextImageItemId =
  ImageSizePreset | 'smaller' | 'larger' | 'remove'

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
  imageToolbar?: string
  imageButton?: (item: RichTextImageItemId) => string
}

/** What a parent can do to the editor, e.g. from buttons of its own */
export interface RichTextEditorActions {
  /** Opens the link dialog on the selection */
  openLinkDialog: () => void
  /** Opens the picker of the images to insert; false if images are not handled */
  pickImages: () => boolean
}

/** What the editor's extensions call back, kept current by the component */
export interface EditorActions {
  openLinkDialog: () => void
  focusToolbar: () => void
  /** Moves the focus to the toolbar of the selected image; false if none */
  focusImageToolbar: () => boolean
  storeImages: ((files: File[]) => Promise<InlineImageAttributes[]>) | null
}
