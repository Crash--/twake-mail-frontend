import type { ReactElement } from 'react'

import {
  ErrorScreen,
  type ErrorScreenProps
} from '@/ds/ErrorScreen/ErrorScreen'
import { useDocumentTitle } from '@common/app/DocumentTitleProvider'

export type ViewErrorScreenProps = Omit<
  ErrorScreenProps,
  'headingLevel' | 'focusOnMount'
> & {
  /** The name of the page when the title is a sentence ("Error") */
  documentTitle?: string
}

/**
 * An error that takes the place of a whole view: like any view, it names
 * the page (`<title> - Twake Mail`), has the `h1` and takes the focus.
 */
export function ViewErrorScreen({
  documentTitle,
  ...props
}: ViewErrorScreenProps): ReactElement {
  useDocumentTitle(documentTitle ?? props.title)
  return <ErrorScreen {...props} headingLevel="h1" focusOnMount />
}
