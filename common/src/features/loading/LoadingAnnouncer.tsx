import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

import { LiveRegion } from '@/ds/LiveRegion/LiveRegion'
import { useI18n } from '@common/i18n/useI18n'

type Register = () => () => void

/**
 * How long "Loading" stays once no skeleton is left: a start that goes
 * through several stages (session, folders, list) unmounts one skeleton a
 * moment before the next one shows, and must still be announced once.
 */
export const LOADING_GRACE_MS = 500

function registerNothing(): () => void {
  return () => undefined
}

const LoadingContext = createContext<Register>(registerNothing)

export interface LoadingAnnouncerProps {
  children: ReactNode
}

/**
 * The one place the page says "Loading": a polite live region, always
 * mounted, whose text is set while at least one view shows its skeleton
 * (`useLoadingAnnouncement`). The folders, the list and the reading view
 * loading together are announced once, not three times; the region empties
 * when the last one is done (after `LOADING_GRACE_MS`, so that stages
 * following each other are announced once too), and says nothing more.
 * Inside another
 * announcer (the one of the whole page, while the app boots), it leaves the
 * views to that one: the page keeps a single region.
 */
export function LoadingAnnouncer({
  children
}: LoadingAnnouncerProps): ReactElement {
  const { t } = useI18n()
  const outer = useContext(LoadingContext)
  const [isLoading, setIsLoading] = useState(false)
  const count = useRef(0)
  const grace = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearGrace = useCallback((): void => {
    if (grace.current === null) return
    clearTimeout(grace.current)
    grace.current = null
  }, [])
  const register = useCallback<Register>(() => {
    count.current += 1
    clearGrace()
    setIsLoading(true)
    return () => {
      count.current -= 1
      if (count.current > 0) return
      grace.current = setTimeout(() => {
        grace.current = null
        setIsLoading(false)
      }, LOADING_GRACE_MS)
    }
  }, [clearGrace])
  useEffect(() => clearGrace, [clearGrace])

  if (outer !== registerNothing) return <>{children}</>
  return (
    <LoadingContext.Provider value={register}>
      {children}
      <LiveRegion data-testid="loading-announcement">
        {isLoading ? t('common.loading') : ''}
      </LiveRegion>
    </LoadingContext.Provider>
  )
}

/** Tells the page that this view is showing a skeleton while `isLoading` */
export function useLoadingAnnouncement(isLoading: boolean): void {
  const register = useContext(LoadingContext)
  useEffect(() => {
    if (!isLoading) return
    return register()
  }, [isLoading, register])
}
