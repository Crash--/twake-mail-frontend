import type {
  RichTextColor,
  RichTextEditorLabels,
  RichTextFontFamily,
  RichTextFontSize
} from '@/ds/RichTextEditor/types'
import { useI18n } from '@common/i18n/useI18n'

import type { QuoteLabels } from './quote'

export interface EditorLabels {
  labels: RichTextEditorLabels
  colors: RichTextColor[]
  fontSizes: RichTextFontSize[]
  fontFamilies: RichTextFontFamily[]
  quote: QuoteLabels
}

/** tmail-flutter's `RichTextWebController.fontSizeList` */
const FONT_SIZES = [10, 12, 14, 15, 16, 18, 24, 36, 48, 64] as const

/**
 * tmail-flutter's `FontNameType`: the names are those of the fonts, and
 * "Sans Serif" is the generic family
 */
const FONT_FAMILIES: RichTextFontFamily[] = [
  { value: 'sans-serif', label: 'Sans Serif' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Arial Black', label: 'Arial Black' },
  { value: 'Brush Script MT', label: 'Brush Script MT' },
  { value: 'Comic Sans MS', label: 'Comic Sans MS' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Helvetica Neue', label: 'Helvetica Neue' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Impact', label: 'Impact' },
  { value: 'Lucida Grande', label: 'Lucida Grande' },
  { value: 'Tahoma', label: 'Tahoma' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS' },
  { value: 'Verdana', label: 'Verdana' }
]

/** The two rows of the colour bar (Twake palette), strong then light */
const PALETTE = [
  ['black', '#000000'],
  ['darkGrey', '#5f6b7a'],
  ['red', '#ff4d4d'],
  ['orange', '#ff9900'],
  ['yellow', '#ffd600'],
  ['green', '#34c759'],
  ['teal', '#00bfa5'],
  ['blue', '#0a84ff'],
  ['purple', '#8e44ad'],
  ['pink', '#ff4081'],
  ['grey', '#8c9caf'],
  ['lightGrey', '#e5ecf3'],
  ['lightRed', '#ffb3b3'],
  ['lightOrange', '#ffd199'],
  ['lightYellow', '#fff0a0'],
  ['lightGreen', '#b9efc8'],
  ['lightTeal', '#99ecdc'],
  ['lightBlue', '#a6d5ff'],
  ['lightPurple', '#d9b8e6'],
  ['lightPink', '#ffc2d9']
] as const

/** The translated strings the editor and the quote need */
export function useEditorLabels(): EditorLabels {
  const { t } = useI18n()
  return {
    labels: {
      editor: t('composer.editor.name'),
      keyboardHelp: t('composer.editor.keyboardHelp'),
      toolbar: t('composer.editor.toolbar'),
      undo: t('composer.editor.undo'),
      redo: t('composer.editor.redo'),
      bold: t('composer.editor.bold'),
      italic: t('composer.editor.italic'),
      underline: t('composer.editor.underline'),
      strike: t('composer.editor.strike'),
      textColor: t('composer.editor.textColor'),
      highlight: t('composer.editor.highlight'),
      fontSize: t('composer.editor.fontSize'),
      fontFamily: t('composer.editor.fontFamily'),
      textStyle: t('composer.editor.textStyle'),
      textStyles: {
        paragraph: t('composer.editor.textStyles.paragraph'),
        h1: t('composer.editor.textStyles.h1'),
        h2: t('composer.editor.textStyles.h2'),
        h3: t('composer.editor.textStyles.h3'),
        h4: t('composer.editor.textStyles.h4'),
        h5: t('composer.editor.textStyles.h5'),
        h6: t('composer.editor.textStyles.h6'),
        blockquote: t('composer.editor.textStyles.blockquote'),
        code: t('composer.editor.textStyles.code')
      },
      lists: t('composer.editor.lists'),
      indent: t('composer.editor.indent'),
      outdent: t('composer.editor.outdent'),
      customColor: t('composer.editor.customColor'),
      noHighlight: t('composer.editor.noHighlight'),
      align: t('composer.editor.align'),
      alignments: {
        left: t('composer.editor.alignLeft'),
        center: t('composer.editor.alignCenter'),
        right: t('composer.editor.alignRight'),
        justify: t('composer.editor.alignJustify')
      },
      bulletList: t('composer.editor.bulletList'),
      orderedList: t('composer.editor.orderedList'),
      blockquote: t('composer.editor.blockquote'),
      link: t('composer.editor.link'),
      insertImage: t('composer.editor.insertImage'),
      clearFormatting: t('composer.editor.clearFormatting'),
      linkDialog: {
        title: t('composer.link.title'),
        text: t('composer.link.text'),
        url: t('composer.link.url'),
        apply: t('composer.link.apply'),
        cancel: t('composer.link.cancel'),
        remove: t('composer.link.remove')
      },
      image: {
        toolbar: t('composer.editor.image.toolbar'),
        sizes: {
          small: t('composer.editor.image.small'),
          medium: t('composer.editor.image.medium'),
          large: t('composer.editor.image.large'),
          original: t('composer.editor.image.original')
        },
        smaller: t('composer.editor.image.smaller'),
        larger: t('composer.editor.image.larger'),
        remove: t('composer.editor.image.remove'),
        sizeStatus: (width, percent) =>
          t('composer.editor.image.sizeStatus', { width, percent })
      }
    },
    colors: [
      { value: null, label: t('composer.editor.defaultColor') },
      ...PALETTE.map(([key, value]) => ({
        value,
        label: t(`composer.editor.colors.${key}`)
      }))
    ],
    fontSizes: FONT_SIZES.map(size => ({
      value: `${size}px`,
      label: String(size)
    })),
    fontFamilies: FONT_FAMILIES,
    quote: {
      replyHeader: (sentDate, emailAddress) =>
        t('composer.quote.replyHeader', { sentDate, emailAddress }),
      forwarded: t('composer.quote.forwarded'),
      subject: t('composer.quote.subject'),
      date: t('composer.quote.date'),
      from: t('composer.quote.from'),
      to: t('composer.quote.to'),
      cc: t('composer.quote.cc'),
      bcc: t('composer.quote.bcc'),
      replyTo: t('composer.quote.replyTo')
    }
  }
}
