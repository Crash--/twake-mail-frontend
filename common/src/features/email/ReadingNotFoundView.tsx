import { Empty } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { EmailOpen } from '@/ds/FlutterIcons/FlutterIcons'
import { ReadingPane } from '@/ds/ReadingPane/ReadingPane'
import { useDocumentTitle } from '@common/app/DocumentTitleProvider'
import { useI18n } from '@common/i18n/useI18n'

import { ReadingToolbar } from './ReadingToolbar'

const NO_NAVIGATION = { openPrevious: null, openNext: null }

export interface ReadingNotFoundViewProps {
  /** Why there is nothing to read, the heading and the name of the page */
  title: string
  onBack: () => void
}

/**
 * An email or a conversation that no longer exists: the way back to the
 * list stays, and the reason is the heading of the view and of the page.
 */
export function ReadingNotFoundView({
  title,
  onBack
}: ReadingNotFoundViewProps): ReactElement {
  const { t } = useI18n()
  useDocumentTitle(title)
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
      <Empty
        icon={EmailOpen}
        title={title}
        componentsProps={{
          // The title says it: the icon is decoration
          icon: { 'aria-hidden': true },
          title: { component: 'h1' }
        }}
        data-testid="email-not-found"
      />
    </ReadingPane>
  )
}
