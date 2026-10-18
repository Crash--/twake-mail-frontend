// Upstream to twake-ui: yes, with `Main`. A page has one `main` landmark:
// a component that is sometimes the whole page (an error screen) and
// sometimes inside a layout needs to know whether one is already there, and
// twake-mui's `Main` does not tell.
import { Box } from '@linagora/twake-mui'
import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode
} from 'react'

const IsInMainContext = createContext(false)

export interface InsideMainLandmarkProps {
  children: ReactNode
}

/** Tells its content it is in a `main` landmark the caller renders */
export function InsideMainLandmark({
  children
}: InsideMainLandmarkProps): ReactElement {
  return (
    <IsInMainContext.Provider value={true}>{children}</IsInMainContext.Provider>
  )
}

/** Whether a `main` landmark (`MainLandmark`, `FlatMain`…) is around */
export function useIsInMainLandmark(): boolean {
  return useContext(IsInMainContext)
}

export interface MainLandmarkProps {
  children: ReactNode
  /** twake-css classes of the `main` element */
  className?: string
}

/** The `main` landmark of the page, which its content knows it is in */
export function MainLandmark({
  children,
  className
}: MainLandmarkProps): ReactElement {
  return (
    <Box component="main" className={className}>
      <InsideMainLandmark>{children}</InsideMainLandmark>
    </Box>
  )
}
