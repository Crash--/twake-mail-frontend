import type { AppListEntry } from './config'

/** Where the image of tmail-flutter looks for the apps (`env.file` sits next to it) */
export const APP_DASHBOARD_PATH = '/assets/configurations/app_dashboard.json'

const ICONS_PATH = '/assets/images/svg'

/** Shown for an icon name this app does not ship */
export const GENERIC_APP_ICON = `${ICONS_PATH}/app-generic.svg`

/**
 * The icons of `configurations/icons/` of tmail-flutter, which
 * `app_dashboard.json` names by file, and the icon this app ships for each.
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
 * generic icon otherwise (a file of the Flutter bundle this app lacks).
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

function isAppListEntry(value: unknown): value is AppListEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'link' in value &&
    typeof value.link === 'string' &&
    'icon' in value &&
    typeof value.icon === 'string'
  )
}

function readEntryString(entry: object, key: string): string | undefined {
  const value: unknown = Object.getOwnPropertyDescriptor(entry, key)?.value
  return typeof value === 'string' ? value : undefined
}

/**
 * An app as tmail-flutter writes it (`appName`, `appLink`, `icon` and
 * `publicIconUri`) becomes an entry as `appList.js` writes it. A
 * `publicIconUri` is the icon; else the `icon` file name is mapped to an icon
 * of this app. An entry already in the `appList.js` shape is kept.
 */
function fromFlutterAppEntry(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  const name = readEntryString(value, 'appName')
  const link = readEntryString(value, 'appLink')
  if (name === undefined || link === undefined) return value
  return {
    name,
    link,
    icon:
      readEntryString(value, 'publicIconUri') ??
      resolveFlutterAppIcon(readEntryString(value, 'icon'))
  }
}

/** The valid entries of an app list, in either shape; anything else is left out */
export function normalizeAppList(value: unknown): AppListEntry[] {
  return Array.isArray(value)
    ? value.map(fromFlutterAppEntry).filter(isAppListEntry)
    : []
}

/**
 * The apps of an `app_dashboard.json` (`{ "apps": [...] }`); none when the
 * document is not of that shape.
 */
export function parseAppDashboard(document: unknown): AppListEntry[] {
  if (typeof document !== 'object' || document === null) return []
  return normalizeAppList(
    Object.getOwnPropertyDescriptor(document, 'apps')?.value
  )
}

/**
 * Reads `app_dashboard.json`, mounted by the Helm chart of tmail-frontend.
 * Without the file the server answers with `index.html`: no apps, as for any
 * other failure.
 */
export async function loadAppDashboard(
  url: string,
  fetchJson: typeof fetch = fetch
): Promise<AppListEntry[]> {
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
