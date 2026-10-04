import { useEffect } from 'react'

import { useI18n } from '@common/i18n/useI18n'

/**
 * Sets the `<title>` of the page for the current view, `<view> - Twake
 * Mail`, or the app name alone while `view` is null (RGAA 8.6).
 */
export function useDocumentTitle(view: string | null): void {
  const { t } = useI18n()
  const appName = t('app.name')
  useEffect(() => {
    document.title =
      view === null || view === '' ? appName : `${view} - ${appName}`
  }, [view, appName])
}
