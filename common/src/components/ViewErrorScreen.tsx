import type { ReactElement } from 'react'

import {
  ErrorScreen,
  type ErrorScreenProps
} from '@/ds/ErrorScreen/ErrorScreen'
import { useDocumentTitle } from '@common/app/DocumentTitleProvider'

export type ViewErrorScreenProps = Omit<
  ErrorScreenProps,
  'headingLevel' | 'autoFocus'
>

/**
 * An error that takes the place of a whole view: like any view, it names
 * the page (`<title> - Twake Mail`), has the `h1` and takes the focus.
 */
export function ViewErrorScreen(props: ViewErrorScreenProps): ReactElement {
  useDocumentTitle(props.title)
  return <ErrorScreen {...props} headingLevel="h1" autoFocus />
}
