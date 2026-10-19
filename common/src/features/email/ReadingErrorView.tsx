import type { ReactElement } from 'react'

import { ReadingPane } from '@/ds/ReadingPane/ReadingPane'
import { ViewErrorScreen } from '@common/components/ViewErrorScreen'
import { useI18n } from '@common/i18n/useI18n'

import { ReadingToolbar } from './ReadingToolbar'
import type { EmailViewNavigation } from './useEmailViewShortcuts'

const NO_NAVIGATION: EmailViewNavigation = {
  openPrevious: null,
  openNext: null
}

export interface ReadingErrorViewProps {
  /** The way back to the list: only this email or conversation failed */
  onBack: () => void
  onRetry: () => void
  navigation?: EmailViewNavigation
}

/**
 * An email or a conversation that could not load: its toolbar stays, with
 * the way back to the list, and the error takes the place of the content
 * like any view (it names the page, has the `h1` and focuses Retry).
 */
export function ReadingErrorView({
  onBack,
  onRetry,
  navigation = NO_NAVIGATION
}: ReadingErrorViewProps): ReactElement {
  const { t } = useI18n()
  return (
    <ReadingPane
      toolbar={
        <ReadingToolbar
          onBack={onBack}
          navigation={navigation}
          label={t('thread.actions')}
        />
      }
    >
      <ViewErrorScreen
        title={t('common.errorOccurred')}
        documentTitle={t('common.errorTitle')}
        actionLabel={t('common.retry')}
        onAction={onRetry}
        data-testid="email-view-error"
      />
    </ReadingPane>
  )
}
