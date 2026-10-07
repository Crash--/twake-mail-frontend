import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

import { formatCount } from '@/ds/CountBadge/formatCount'
import { useI18n } from '@common/i18n/useI18n'

interface ViewTitle {
  id: string
  view: string | null
}

interface DocumentTitleApi {
  /** Adds the title of a view, or updates it in place */
  setView: (id: string, view: string | null) => void
  removeView: (id: string) => void
  setUnreadCount: (count: number | null) => void
}

function doNothing(): void {
  // Outside a DocumentTitleProvider, the title of the page is left alone
}

const DocumentTitleContext = createContext<DocumentTitleApi>({
  setView: doNothing,
  removeView: doNothing,
  setUnreadCount: doNothing
})

export interface DocumentTitleProviderProps {
  children: ReactNode
}

/**
 * Owns the `<title>` of the page: `(<unread>) <view> - Twake Mail`. The
 * view is the last one shown (an email opened beside the list), the one
 * underneath when it goes; the unread count of the Inbox comes first, so
 * that it shows on the tab of the browser.
 */
export function DocumentTitleProvider({
  children
}: DocumentTitleProviderProps): ReactElement {
  const { t } = useI18n()
  const appName = t('app.name')
  const [views, setViews] = useState<ViewTitle[]>([])
  const [unreadCount, setUnreadCount] = useState<number | null>(null)

  const api = useMemo<DocumentTitleApi>(
    () => ({
      setView: (id, view) => {
        setViews(current =>
          current.some(entry => entry.id === id)
            ? current.map(entry => (entry.id === id ? { id, view } : entry))
            : [...current, { id, view }]
        )
      },
      removeView: id => {
        setViews(current => current.filter(entry => entry.id !== id))
      },
      setUnreadCount
    }),
    []
  )

  const view = views.at(-1)?.view ?? null
  useEffect(() => {
    const title =
      view === null || view === '' ? appName : `${view} - ${appName}`
    document.title =
      unreadCount === null || unreadCount <= 0
        ? title
        : `(${formatCount(unreadCount)}) ${title}`
  }, [view, unreadCount, appName])

  return (
    <DocumentTitleContext.Provider value={api}>
      {children}
    </DocumentTitleContext.Provider>
  )
}

/**
 * Sets the `<title>` of the page for the current view, `<view> - Twake
 * Mail`, or the app name alone while `view` is null (RGAA 8.6). The title
 * of the view underneath comes back when the view goes: an email closed
 * beside the list gives the title back to the list.
 */
export function useDocumentTitle(view: string | null): void {
  const { setView, removeView } = useContext(DocumentTitleContext)
  const id = useId()
  useEffect(() => {
    setView(id, view)
  }, [id, view, setView])
  useEffect(
    () => () => {
      removeView(id)
    },
    [id, removeView]
  )
}

/** Puts the unread count of the Inbox before the title, null for none */
export function useUnreadCountInTitle(count: number | null): void {
  const { setUnreadCount } = useContext(DocumentTitleContext)
  useEffect(() => {
    setUnreadCount(count)
  }, [count, setUnreadCount])
  useEffect(
    () => () => {
      setUnreadCount(null)
    },
    [setUnreadCount]
  )
}
