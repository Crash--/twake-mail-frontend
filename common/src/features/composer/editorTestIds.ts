import type { RichTextEditorTestIds } from '@/ds/RichTextEditor/types'

/**
 * The `data-testid` of the composer's editor, a contract with the end to end
 * tests (e2e/pages/README.md)
 */
export const EDITOR_TEST_IDS: RichTextEditorTestIds = {
  editor: 'composer-editor',
  toolbarButton: item => `rich-text-${item}-button`,
  linkTextInput: 'link-dialog-text-input',
  linkUrlInput: 'link-dialog-url-input',
  linkApplyButton: 'link-dialog-apply-button',
  imageToolbar: 'rich-text-image-toolbar',
  imageAltInput: 'rich-text-image-alt-input',
  imageButton: item => `rich-text-image-${item}-button`
}

/** The `data-testid` of the "edit the quoted message" button of a block */
export function htmlBlockEditTestId(kind: string): string {
  return `html-block-edit-${kind}`
}
