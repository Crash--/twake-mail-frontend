import type { BarFallbackApp } from '@linagora/twake-bar'
import { useQuery } from '@tanstack/react-query'

import { useAppConfig } from '@common/config/AppConfigProvider'

/** Where tmail-flutter web reads its apps, and the chart of tmail-frontend mounts them */
export const APP_DASHBOARD_PATH = '/assets/configurations/app_dashboard.json'

const ICONS_PATH = '/assets/images/svg'

/** Shown for an icon name this app does not ship */
export const GENERIC_APP_ICON = `${ICONS_PATH}/app-generic.svg`

/**
 * The icons of `configurations/icons/` of tmail-flutter, which
 * `app_dashboard.json` names by file, and the icon this app ships for each
 */
const FLUTTER_APP_ICONS: Readonly<Record<string, string>> = {
  'ic_twake_app.svg': `${ICONS_PATH}/app-chat.svg`,
  'ic_tdrive_app.svg': `${ICONS_PATH}/app-drive.svg`,
  'ic_tmail_app.svg': `${ICONS_PATH}/app-mail.svg`,
  'ic_calendar_app.svg': `${ICONS_PATH}/app-calendar.svg`,
  'ic_contacts_app.svg': `${ICONS_PATH}/app-contacts.svg`,
  'ic_teleskop_app.svg': `${ICONS_PATH}/app-meet.svg`
}

/**
 * The icon to show for the `icon` of an app of `app_dashboard.json`: the
 * shipped icon of a known file name, an absolute URL or path as is, the
 * generic icon otherwise (a file of the Flutter bundle this app lacks)
 */
export function resolveFlutterAppIcon(icon: string | undefined): string {
  if (icon === undefined) return GENERIC_APP_ICON
  const known: unknown = Object.getOwnPropertyDescriptor(
    FLUTTER_APP_ICONS,
    icon
  )?.value
  if (typeof known === 'string') return known
  return /^(https?:\/\/|\/(?!\/))/.test(icon) ? icon : GENERIC_APP_ICON
}

function readString(entry: object, key: string): string | undefined {
  const value: unknown = Object.getOwnPropertyDescriptor(entry, key)?.value
  return typeof value === 'string' ? value : undefined
}

/** An app as tmail-flutter writes it (`appName`, `appLink`, `icon`, `publicIconUri`) */
function toBarApp(value: unknown): BarFallbackApp | null {
  if (typeof value !== 'object' || value === null) return null
  const name = readString(value, 'appName')
  const href = readString(value, 'appLink')
  if (name === undefined || href === undefined) return null
  const icon = readString(value, 'icon')
  const publicIconUri = readString(value, 'publicIconUri')
  return {
    name,
    href,
    icon:
      icon === undefined && publicIconUri !== undefined
        ? publicIconUri
        : resolveFlutterAppIcon(icon)
  }
}

/** The apps of an `app_dashboard.json` (`{ "apps": [...] }`), invalid ones left out */
export function parseAppDashboard(document: unknown): BarFallbackApp[] {
  if (typeof document !== 'object' || document === null) return []
  const apps: unknown = Object.getOwnPropertyDescriptor(document, 'apps')?.value
  return Array.isArray(apps)
    ? apps.map(toBarApp).filter(app => app !== null)
    : []
}

/**
 * Reads `app_dashboard.json`. Without the file the server answers with
 * `index.html`: no apps, as for any other failure.
 */
export async function loadAppDashboard(
  url: string,
  fetchJson: typeof fetch = fetch
): Promise<BarFallbackApp[]> {
  try {
    const response = await fetchJson(url, {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(5000)
    })
    if (!response.ok) return []
    return parseAppDashboard(await response.json())
  } catch {
    return []
  }
}

/**
 * The apps of `app_dashboard.json` when `APP_GRID_AVAILABLE` is supported
 * and `isNeeded` (off the Workplace); none otherwise
 */
export function useAppDashboard(isNeeded: boolean): BarFallbackApp[] {
  const isAvailable = useAppConfig()?.appGridAvailable ?? false
  const { data } = useQuery({
    queryKey: ['app-dashboard'],
    queryFn: () =>
      loadAppDashboard(
        new URL(APP_DASHBOARD_PATH, window.location.origin).href
      ),
    enabled: isAvailable && isNeeded,
    staleTime: Infinity
  })
  return data ?? []
}
