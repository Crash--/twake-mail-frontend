import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

import { useFloatingActionInset } from '@/ds/FloatingActionButton/FloatingActionButton'
import {
  ToastRegion,
  type ToastItem,
  type ToastSeverity
} from '@/ds/ToastRegion/ToastRegion'
import { useI18n } from '@common/i18n/useI18n'

export interface NotificationAction {
  label: string
  onClick: () => void
  /** An undo: the `z` shortcut runs it too */
  isUndo?: boolean
  'data-testid'?: string
}

export interface Notification {
  message: string
  /** `info` by default; `error` is announced at once */
  severity?: ToastSeverity
  action?: NotificationAction | null
  /** In ms; `null` keeps it until closed. A default fit for its action otherwise */
  duration?: number | null
}

export interface NotificationsApi {
  /** Shows a notification instead of the current one; returns its id */
  notify: (notification: Notification) => string
  dismiss: (id: string) => void
  /** Runs the undo of the notification shown, if it has one; false if not */
  undoLast: () => boolean
}

const NotificationsContext = createContext<NotificationsApi | null>(null)

interface ShownNotification extends ToastItem {
  isUndo: boolean
}

export interface NotificationsProviderProps {
  children: ReactNode
}

/**
 * The toasts of the app: `useNotify().notify({ message, action })` shows
 * one at the bottom of the screen (above the floating "New message" button
 * on phones and tablets), announced to screen readers (`ds/ToastRegion`).
 */
export function NotificationsProvider({
  children
}: NotificationsProviderProps): ReactElement {
  const { t } = useI18n()
  const floatingActionInset = useFloatingActionInset()
  const [shown, setShown] = useState<ShownNotification | null>(null)
  const shownRef = useRef<ShownNotification | null>(null)
  const counter = useRef(0)

  const show = useCallback((next: ShownNotification | null): void => {
    shownRef.current = next
    setShown(next)
  }, [])

  const notify = useCallback(
    ({
      message,
      severity = 'info',
      action = null,
      duration
    }: Notification): string => {
      counter.current += 1
      const id = `notification-${counter.current}`
      show({
        id,
        message,
        severity,
        action:
          action === null
            ? null
            : {
                label: action.label,
                onClick: action.onClick,
                'data-testid': action['data-testid'] ?? 'toast-action-button'
              },
        ...(duration === undefined ? {} : { duration }),
        isUndo: action?.isUndo ?? false
      })
      return id
    },
    [show]
  )

  const dismiss = useCallback(
    (id: string): void => {
      if (shownRef.current?.id === id) show(null)
    },
    [show]
  )

  const undoLast = useCallback((): boolean => {
    const current = shownRef.current
    if (current === null || !current.isUndo || !current.action) return false
    show(null)
    current.action.onClick()
    return true
  }, [show])

  const api = useMemo<NotificationsApi>(
    () => ({ notify, dismiss, undoLast }),
    [notify, dismiss, undoLast]
  )

  const handleClose = useCallback(
    (id: string): void => {
      dismiss(id)
    },
    [dismiss]
  )

  return (
    <NotificationsContext.Provider value={api}>
      {children}
      <ToastRegion
        toast={shown}
        onClose={handleClose}
        closeLabel={t('common.close')}
        bottomOffset={floatingActionInset}
        data-testid="toast"
      />
    </NotificationsContext.Provider>
  )
}

/** Shows toasts; needs a `NotificationsProvider` (in `AppProviders`) */
export function useNotify(): NotificationsApi {
  const api = useContext(NotificationsContext)
  if (!api) {
    throw new Error('useNotify needs a NotificationsProvider')
  }
  return api
}
