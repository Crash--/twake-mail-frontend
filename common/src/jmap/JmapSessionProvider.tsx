import { useQuery } from '@tanstack/react-query'
import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode
} from 'react'

import { ErrorScreen } from '@common/components/ErrorScreen'
import { FullPageLoader } from '@common/components/FullPageLoader'
import { useI18n } from '@common/i18n/useI18n'

import { useJmapClient } from './JmapClientProvider'
import { sessionQueryOptions, type JmapSessionInfo } from './queries'

const JmapSessionContext = createContext<JmapSessionInfo | null>(null)

export interface JmapSessionProviderProps {
  children: ReactNode
}

/**
 * Loads the JMAP session of the signed-in user, then renders the mail
 * screens, which read it with `useJmapSession`.
 */
export function JmapSessionProvider({
  children
}: JmapSessionProviderProps): ReactElement {
  const { t } = useI18n()
  const client = useJmapClient()
  const query = useQuery(sessionQueryOptions(client))

  if (query.isPending) return <FullPageLoader />

  if (query.isError) {
    const handleRetry = (): void => {
      void query.refetch()
    }
    return (
      <ErrorScreen
        title={t('common.errorOccurred')}
        actionLabel={t('common.retry')}
        onAction={handleRetry}
        data-testid="session-error"
      />
    )
  }

  return (
    <JmapSessionContext.Provider value={query.data}>
      {children}
    </JmapSessionContext.Provider>
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
