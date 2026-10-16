import { useQuery } from '@tanstack/react-query'
import {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode
} from 'react'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { useDocumentTitle } from '@common/app/DocumentTitleProvider'
import { FullPageLoader } from '@common/components/FullPageLoader'
import { useI18n } from '@common/i18n/useI18n'

import { ScopedJmapClient, useJmapClient } from './JmapClientProvider'
import { sessionQueryOptions, type JmapSessionInfo } from './queries'
import { withExtraCapabilities } from './withExtraCapabilities'

const JmapSessionContext = createContext<JmapSessionInfo | null>(null)

export interface JmapSessionProviderProps {
  children: ReactNode
  /** Shown while the session loads, a full-page spinner by default */
  loading?: ReactNode
  /** Puts the error screen in a frame, shown bare by default */
  renderError?: (errorScreen: ReactElement) => ReactNode
}

function showBare(errorScreen: ReactElement): ReactNode {
  return errorScreen
}

/**
 * Loads the JMAP session of the signed-in user, then renders the mail
 * screens, which read it with `useJmapSession`. Their client sends the
 * extra capabilities of the session (team mailboxes) in every request.
 */
export function JmapSessionProvider({
  children,
  loading = <FullPageLoader />,
  renderError = showBare
}: JmapSessionProviderProps): ReactElement {
  const client = useJmapClient()
  const query = useQuery(sessionQueryOptions(client))
  const extraCapabilities = query.data?.extraCapabilities
  const scopedClient = useMemo(
    () => withExtraCapabilities(client, extraCapabilities ?? []),
    [client, extraCapabilities]
  )

  if (query.isPending) return <>{loading}</>

  if (query.isError) {
    const handleRetry = (): void => {
      void query.refetch()
    }
    return <>{renderError(<SessionErrorScreen onRetry={handleRetry} />)}</>
  }

  return (
    <JmapSessionContext.Provider value={query.data}>
      <ScopedJmapClient client={scopedClient}>{children}</ScopedJmapClient>
    </JmapSessionContext.Provider>
  )
}

interface SessionErrorScreenProps {
  onRetry: () => void
}

/** Takes the focus and the title of the page, as the view it replaces */
function SessionErrorScreen({
  onRetry
}: SessionErrorScreenProps): ReactElement {
  const { t } = useI18n()
  useDocumentTitle(t('common.connectionError'))
  return (
    <ErrorScreen
      title={t('common.errorOccurred')}
      actionLabel={t('common.retry')}
      onAction={onRetry}
      focusOnMount
      data-testid="session-error"
    />
  )
}

/**
 * The JMAP session and the mail account of the signed-in user.
 */
export function useJmapSession(): JmapSessionInfo {
  const session = useContext(JmapSessionContext)
  if (!session) {
    throw new Error('useJmapSession must be used within a JmapSessionProvider')
  }
  return session
}
