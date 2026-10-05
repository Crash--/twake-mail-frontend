// Upstream to twake-ui: yes, as a prop of `Nav`. twake-mui's `Nav` has a
// fixed `margin: 24px 0`, which leaves a gap under a section header.
import { Nav } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export interface NavTreeProps {
  children: ReactNode
  role?: 'tree'
  'aria-labelledby'?: string
  'aria-busy'?: boolean
  'data-testid'?: string
}

/** A `Nav` list of a sidebar section, without the outer margin of `Nav` */
export function NavTree({ children, ...props }: NavTreeProps): ReactElement {
  return (
    <Nav sx={{ my: 0 }} {...props}>
      {children}
    </Nav>
  )
}
