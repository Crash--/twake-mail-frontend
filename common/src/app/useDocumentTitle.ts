import { useEffect } from 'react'

import { useI18n } from '@common/i18n/useI18n'

/**
 * Sets the `<title>` of the page for the current view, `<view> - Twake
 * Mail`, or the app name alone while `view` is null (RGAA 8.6). The title
 * of the view underneath comes back when the view goes: an email closed
 * beside the list gives the title back to the list.
 */
export function useDocumentTitle(view: string | null): void {
  const { t } = useI18n()
  const appName = t('app.name')
  useEffect(() => {
    const previous = document.title
    document.title =
      view === null || view === '' ? appName : `${view} - ${appName}`
    return () => {
      document.title = previous
    }
  }, [view, appName])
}
