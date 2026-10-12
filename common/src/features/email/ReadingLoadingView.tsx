import type { ReactElement } from 'react'

import { ReadingPane } from '@/ds/ReadingPane/ReadingPane'
import { ReadingSkeleton } from '@/ds/ReadingSkeleton/ReadingSkeleton'
import { AfterDelay } from '@common/features/loading/AfterDelay'
import { useLoadingAnnouncement } from '@common/features/loading/LoadingAnnouncer'
import { useI18n } from '@common/i18n/useI18n'

import { ReadingToolbar } from './ReadingToolbar'

const NO_NAVIGATION = { openPrevious: null, openNext: null }

/** The subject, header and body shapes, announced as loading */
function ReadingShapes(): ReactElement {
  useLoadingAnnouncement(true)
  return <ReadingSkeleton data-testid="email-view-loading" />
}

export interface ReadingLoadingViewProps {
  /** The way back to the list, which does not wait for the email */
  onBack: () => void
}

/**
 * An email or a conversation while it loads: its real toolbar (the way back
 * is there, the next and previous emails are not known yet), then the
 * shapes of the subject, the header of a message and its body.
 */
export function ReadingLoadingView({
  onBack
}: ReadingLoadingViewProps): ReactElement {
  const { t } = useI18n()
  return (
    <ReadingPane
      toolbar={
        <ReadingToolbar
          onBack={onBack}
          navigation={NO_NAVIGATION}
          label={t('thread.actions')}
        />
      }
    >
      <AfterDelay>
        <ReadingShapes />
      </AfterDelay>
    </ReadingPane>
  )
}
