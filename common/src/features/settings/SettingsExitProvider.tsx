import {
  createContext,
  useContext,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import { useLocation } from 'react-router'

import { SETTINGS_PATH } from './sections'

const SettingsExitContext = createContext<string>('/')

export function isSettingsPath(pathname: string): boolean {
  return pathname === SETTINGS_PATH || pathname.startsWith(`${SETTINGS_PATH}/`)
}

export interface SettingsExitProviderProps {
  children: ReactNode
}

/**
 * Remembers the last page of the mail (folder, email, search) the user
 * was on, where "Back to mail" leaves the settings for, as tmail-flutter
 * does (`previousUri`); the inbox when the settings were opened first.
 */
export function SettingsExitProvider({
  children
}: SettingsExitProviderProps): ReactElement {
  const location = useLocation()
  const isSettings = isSettingsPath(location.pathname)
  const current = `${location.pathname}${location.search}`
  const [exitPath, setExitPath] = useState(isSettings ? '/' : current)
  if (!isSettings && exitPath !== current) setExitPath(current)

  return (
    <SettingsExitContext.Provider value={exitPath}>
      {children}
    </SettingsExitContext.Provider>
  )
}

/**
 * The location state of "Back to mail": the focus goes back to the
 * Settings button, which opened them
 */
export interface SettingsExitState {
  fromSettings: true
}

export const SETTINGS_EXIT_STATE: SettingsExitState = { fromSettings: true }

export function isSettingsExitState(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    'fromSettings' in state &&
    state.fromSettings === true
  )
}

/** Where leaving the settings goes */
export function useSettingsExitPath(): string {
  return useContext(SettingsExitContext)
}
