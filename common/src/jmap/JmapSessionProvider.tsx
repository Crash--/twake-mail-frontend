import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { useDocumentTitle } from '@common/app/DocumentTitleProvider'
import { FullPageLoader } from '@common/components/FullPageLoader'
import { useI18n } from '@common/i18n/useI18n'

import { ScopedJmapClient, useJmapClient } from './JmapClientProvider'
import {
  mailboxViewKey,
  OWN_VIEW,
  readMailboxView,
  validMailboxView,
  writeMailboxView,
  type MailboxView
} from './mailboxView'
import { jmapKeys, sessionQueryOptions, type JmapSessionInfo } from './queries'
import { withExtraCapabilities } from './withExtraCapabilities'

/** What the mail screens read of the session and of the mailbox they show */
export interface MailSessionInfo extends JmapSessionInfo {
  /**
   * The account of the mailbox shown: the user's own (the primary mail
   * account), or the one of a mailbox delegated to them
   */
  accountId: string
  /** The primary mail account of the user, whatever the mailbox shown */
  ownAccountId: string
  /**
   * The address of the owner of the mailbox shown: the user's, or the
   * one of the person who delegated it
   */
  mailAddress: string
  view: MailboxView
}

interface MailboxViewApi {
  view: MailboxView
  /**
   * Shows another mailbox: the cache of the queries is cleared and the
   * screens below are mounted again, on the new account
   */
  switchView: (view: MailboxView) => void
  /**
   * The delegated mailbox shown was taken back from the user (no longer in
   * the session): their own one is shown instead, until this is dismissed
   * (once told). `name`: its owner's address, when known.
   */
  lostAccess: { name: string | null } | null
  dismissLostAccess: () => void
}

const JmapSessionContext = createContext<MailSessionInfo | null>(null)
const MailboxViewContext = createContext<MailboxViewApi | null>(null)

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
  const queryClient = useQueryClient()
  const query = useQuery(sessionQueryOptions(client))
  const extraCapabilities = query.data?.extraCapabilities
  const scopedClient = useMemo(
    () => withExtraCapabilities(client, extraCapabilities ?? []),
    [client, extraCapabilities]
  )
  const username = query.data?.session.username ?? null
  const [chosenView, setChosenView] = useState<MailboxView | null>(null)
  /** Asked for: shown once the cache of the previous one is gone */
  const [pendingView, setPendingView] = useState<MailboxView | null>(null)
  const storedView = useMemo(
    () => (username === null ? OWN_VIEW : readMailboxView(username)),
    [username]
  )
  const session = query.data?.session ?? null
  const requestedView = chosenView ?? storedView
  const view =
    session === null ? OWN_VIEW : validMailboxView(requestedView, session)
  /** Asked for a delegated mailbox the session no longer lists */
  const isRevoked =
    session !== null &&
    pendingView === null &&
    requestedView.kind === 'delegated' &&
    view.kind === 'own'
  const [lostAccess, setLostAccess] = useState<{
    name: string | null
  } | null>(null)
  /** The owners of the delegated accounts, kept once they leave the session */
  const ownerNames = useRef(new Map<string, string>())

  useEffect(() => {
    if (session === null) return
    for (const [id, account] of Object.entries(session.accounts)) {
      if (!account.isPersonal) ownerNames.current.set(id, account.name)
    }
  }, [session])

  // A delegation taken back: the user's own mailbox, as when they pick it
  // (its cache is reset), and they are told why
  useEffect(() => {
    // `isRevoked` narrows `requestedView` to a delegated one
    if (!isRevoked) return undefined
    const name = ownerNames.current.get(requestedView.accountId) ?? null
    const timer = setTimeout(() => {
      setLostAccess({ name })
      setPendingView(OWN_VIEW)
    }, 0)
    return () => {
      clearTimeout(timer)
    }
  }, [isRevoked, requestedView])

  // Changing mailbox resets the local cache: nothing of the previous one
  // shows, nor stays in memory. The screens of the previous mailbox are
  // unmounted first (the loader shows), so that none refetches its queries.
  useEffect(() => {
    if (pendingView === null || username === null) return
    // Once the screens of the previous mailbox are gone
    const timer = setTimeout(() => {
      queryClient.removeQueries({
        predicate: cached => cached.queryKey[0] !== jmapKeys.session()[0]
      })
      writeMailboxView(username, pendingView)
      setChosenView(pendingView)
      setPendingView(null)
    }, 0)
    return () => {
      clearTimeout(timer)
    }
  }, [pendingView, queryClient, username])

  const switchView = useCallback((next: MailboxView): void => {
    setPendingView(next)
  }, [])
  const dismissLostAccess = useCallback((): void => {
    setLostAccess(null)
  }, [])
  const viewApi = useMemo(
    () => ({ view, switchView, lostAccess, dismissLostAccess }),
    [view, switchView, lostAccess, dismissLostAccess]
  )
  const info = useMemo((): MailSessionInfo | null => {
    if (query.data === undefined) return null
    const own = query.data
    const delegated =
      view.kind === 'delegated' ? own.session.accounts[view.accountId] : null
    return {
      ...own,
      ownAccountId: own.accountId,
      accountId: view.kind === 'delegated' ? view.accountId : own.accountId,
      mailAddress: delegated?.name ?? own.session.username,
      view
    }
  }, [query.data, view])

  // Nothing of the other mailbox is shown while it goes
  if (query.isPending || pendingView !== null || isRevoked) {
    return <>{loading}</>
  }

  if (query.isError) {
    const handleRetry = (): void => {
      void query.refetch()
    }
    return <>{renderError(<SessionErrorScreen onRetry={handleRetry} />)}</>
  }

  return (
    <JmapSessionContext.Provider value={info}>
      <MailboxViewContext.Provider value={viewApi}>
        <ScopedJmapClient client={scopedClient}>
          <Fragment key={mailboxViewKey(view)}>{children}</Fragment>
        </ScopedJmapClient>
      </MailboxViewContext.Provider>
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
      headingLevel="h1"
      actionLabel={t('common.retry')}
      onAction={onRetry}
      focusOnMount
      data-testid="session-error"
    />
  )
}

/**
 * The JMAP session of the signed-in user, and the mail account of the
 * mailbox shown (`accountId`).
 */
export function useJmapSession(): MailSessionInfo {
  const session = useContext(JmapSessionContext)
  if (!session) {
    throw new Error('useJmapSession must be used within a JmapSessionProvider')
  }
  return session
}

/** The mailbox shown, and how to show another one */
export function useMailboxView(): MailboxViewApi {
  const api = useContext(MailboxViewContext)
  if (!api) {
    throw new Error('useMailboxView must be used within a JmapSessionProvider')
  }
  return api
}

/**
 * The root of the team mailbox picked in the mailbox switcher, null when
 * none is (and outside a `JmapSessionProvider`)
 */
export function useBoundTeamRootId(): string | null {
  const api = useContext(MailboxViewContext)
  return api?.view.kind === 'team' ? api.view.rootId : null
}
