import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode
} from 'react'

import type { AppConfig } from './config'

const AppConfigContext = createContext<AppConfig | null>(null)

export interface AppConfigProviderProps {
  config: AppConfig
  children: ReactNode
}

/** The runtime configuration, for the screens that show part of it */
export function AppConfigProvider({
  config,
  children
}: AppConfigProviderProps): ReactElement {
  return (
    <AppConfigContext.Provider value={config}>
      {children}
    </AppConfigContext.Provider>
  )
}

/** The runtime configuration; null outside the app (component tests) */
export function useAppConfig(): AppConfig | null {
  return useContext(AppConfigContext)
}
