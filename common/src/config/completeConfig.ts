import { loadAppDashboard } from './appDashboard'
import type { AppConfig } from './config'

/**
 * What the runtime configuration cannot tell by itself, found before the app
 * starts: the apps of `app_dashboard.json` (mounted by the Helm chart of
 * tmail-frontend). Never fails: the app starts with what it has.
 */
export async function completeConfig(config: AppConfig): Promise<AppConfig> {
  if (config.appDashboardUrl === null) return config
  const appList = await loadAppDashboard(config.appDashboardUrl)
  return { ...config, appList, appDashboardUrl: null }
}
