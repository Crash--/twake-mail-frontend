import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

import { LiveRegion } from '@/ds/LiveRegion/LiveRegion'
import { useI18n } from '@common/i18n/useI18n'

type Register = () => () => void

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
 * when the last one is done, and says nothing more. Inside another
 * announcer (the one of the whole page, while the app boots), it leaves the
 * views to that one: the page keeps a single region.
 */
export function LoadingAnnouncer({
  children
}: LoadingAnnouncerProps): ReactElement {
  const { t } = useI18n()
  const outer = useContext(LoadingContext)
  const [count, setCount] = useState(0)
  const register = useCallback<Register>(() => {
    setCount(current => current + 1)
    return () => {
      setCount(current => current - 1)
    }
  }, [])

  if (outer !== registerNothing) return <>{children}</>
  return (
    <LoadingContext.Provider value={register}>
      {children}
      <LiveRegion data-testid="loading-announcement">
        {count > 0 ? t('common.loading') : ''}
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
