import { FormatSize, Image, Link } from '@linagora/twake-icons'
import { useRef, useState, type ReactElement, type RefObject } from 'react'

import {
  ActionIcon,
  ActionIconButton
} from '@/ds/ActionIconButton/ActionIconButton'
import { Icon } from '@/ds/Icon/Icon'
import type { RichTextEditorProps } from '@/ds/RichTextEditor/RichTextEditor'
import type {
  RichTextEditorActions,
  RichTextEditorTestIds
} from '@/ds/RichTextEditor/types'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

import { useEditorLabels, type EditorLabels } from './useEditorLabels'

export interface MessageEditorOptions {
  testIds: RichTextEditorTestIds & { formattingButton: string }
  /** On the image and link buttons (their gap in a bar) */
  buttonClassName?: string
}

export interface MessageEditor {
  /** Spread on `RichTextEditor`: the toolbar under the text, behind "Aa" */
  editorProps: Pick<
    RichTextEditorProps,
    | 'labels'
    | 'colors'
    | 'fontSizes'
    | 'fontFamilies'
    | 'isToolbarBelow'
    | 'isToolbarShown'
    | 'hasInsertButtons'
    | 'actions'
    | 'testIds'
  >
  actions: RefObject<RichTextEditorActions | null>
  labels: EditorLabels['labels']
  /** "Aa": shows or hides the formatting toolbar */
  formattingButton: ReactElement
  imageButton: ReactElement
  linkButton: ReactElement
}

/**
 * The editing block of a message, as the composer has it: the text, the
 * formatting toolbar under it, folded until "Aa" opens it (as tmail-flutter),
 * and the image and link actions, placed by the parent in its own bar
 */
export function useMessageEditor({
  testIds,
  buttonClassName
}: MessageEditorOptions): MessageEditor {
  const { labels, colors, fontSizes, fontFamilies } = useEditorLabels()
  const isPhone = useScreenSize() === 'mobile'
  const actions = useRef<RichTextEditorActions>(null)
  const [isToolbarShown, setIsToolbarShown] = useState(false)

  return {
    editorProps: {
      labels,
      colors,
      fontSizes,
      fontFamilies,
      isToolbarBelow: true,
      isToolbarShown,
      hasInsertButtons: false,
      actions,
      testIds
    },
    actions,
    labels,
    formattingButton: (
      <ActionIconButton
        label={labels.toolbar}
        aria-pressed={isToolbarShown}
        onClick={() => {
          setIsToolbarShown(shown => !shown)
        }}
        data-testid={testIds.formattingButton}
      >
        {/* Not an ActionIcon: the viewBox of FormatSize already holds its margin */}
        <Icon icon={FormatSize} size={isPhone ? 28 : 24} />
      </ActionIconButton>
    ),
    imageButton: (
      <ActionIconButton
        label={labels.insertImage}
        onClick={() => actions.current?.pickImages()}
        className={buttonClassName}
        data-testid={testIds.toolbarButton?.('image')}
      >
        <ActionIcon icon={Image} />
      </ActionIconButton>
    ),
    linkButton: (
      <ActionIconButton
        label={labels.link}
        onClick={() => actions.current?.openLinkDialog()}
        className={buttonClassName}
        data-testid={testIds.toolbarButton?.('link')}
      >
        <ActionIcon icon={Link} />
      </ActionIconButton>
    )
  }
}
