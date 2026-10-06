import { useEffect, useState, type ReactElement } from 'react'

import { LiveRegion } from '@/ds/LiveRegion/LiveRegion'
import { OfflineBanner } from '@/ds/OfflineBanner/OfflineBanner'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useI18n } from '@common/i18n/useI18n'

import { useOnlineStatus } from './useOnlineStatus'

/** Above the toast, which sits at the bottom of the screen */
const BANNER_OFFSET = 56
/** Above the floating "New message" button too */
const BANNER_OFFSET_WITH_FAB = 72

/** How long "Back online" stays in the live region, in ms */
const BACK_ONLINE_MS = 5_000

/**
 * The banner "No internet connection" while the browser is offline, as
 * tmail-flutter's toast: it stays until the network is back, and "Skip"
 * hides it for the rest of the session. The page is told politely, once at
 * each change (a live region always mounted, not the banner, which appears
 * with its text and is often not read).
 */
export interface OfflineNoticeProps {
  /** The floating "New message" button is there at every size (the embedded facade) */
  hasFloatingAction?: boolean
}

export function OfflineNotice({
  hasFloatingAction = false
}: OfflineNoticeProps): ReactElement {
  const { t } = useI18n()
  const isOnline = useOnlineStatus()
  const screenSize = useScreenSize()
  const [isDismissed, setIsDismissed] = useState(false)
  const isShown = !isOnline && !isDismissed
  // "Back online" is only said to who was told about the loss: the banner
  // went away because the network came back, not because it was dismissed
  const [wasShown, setWasShown] = useState(false)
  const [isBackOnline, setIsBackOnline] = useState(false)
  if (isShown !== wasShown) {
    setWasShown(isShown)
    setIsBackOnline(wasShown && isOnline)
  }

  useEffect(() => {
    if (!isBackOnline) return
    const timer = setTimeout(() => {
      setIsBackOnline(false)
    }, BACK_ONLINE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [isBackOnline])

  const handleDismiss = (): void => {
    setIsDismissed(true)
  }

  let announcement = ''
  if (isShown) announcement = t('common.offline')
  else if (isBackOnline) announcement = t('common.backOnline')

  return (
    <>
      <LiveRegion data-testid="network-announcement">{announcement}</LiveRegion>
      {isShown ? (
        <OfflineBanner
          message={t('common.offline')}
          dismissLabel={t('common.dismiss')}
          onDismiss={handleDismiss}
          bottomOffset={
            screenSize === 'desktop' && !hasFloatingAction
              ? BANNER_OFFSET
              : BANNER_OFFSET_WITH_FAB
          }
          data-testid="offline-banner"
        />
      ) : null}
    </>
  )
}
