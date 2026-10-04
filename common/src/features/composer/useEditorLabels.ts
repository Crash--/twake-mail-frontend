import type {
  RichTextColor,
  RichTextEditorLabels,
  RichTextFontSize
} from '@/ds/RichTextEditor/types'
import { useI18n } from '@common/i18n/useI18n'

import type { QuoteLabels } from './quote'

export interface EditorLabels {
  labels: RichTextEditorLabels
  colors: RichTextColor[]
  fontSizes: RichTextFontSize[]
  quote: QuoteLabels
}

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
      fontSize: t('composer.editor.fontSize'),
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
      }
    },
    // AA contrast on white for every colour (4.5:1)
    colors: [
      { value: null, label: t('composer.editor.defaultColor') },
      { value: '#c62828', label: t('composer.editor.colors.red') },
      { value: '#b23c00', label: t('composer.editor.colors.orange') },
      { value: '#2e7d32', label: t('composer.editor.colors.green') },
      { value: '#1565c0', label: t('composer.editor.colors.blue') },
      { value: '#6a1b9a', label: t('composer.editor.colors.purple') },
      { value: '#616161', label: t('composer.editor.colors.grey') }
    ],
    fontSizes: [
      { value: '12px', label: t('composer.editor.sizes.small') },
      { value: null, label: t('composer.editor.sizes.normal') },
      { value: '18px', label: t('composer.editor.sizes.large') },
      { value: '24px', label: t('composer.editor.sizes.huge') }
    ],
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
