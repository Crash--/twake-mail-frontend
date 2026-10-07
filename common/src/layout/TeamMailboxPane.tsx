import { Layout } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { FlatContent, FlatMain } from '@/ds/FlatPanes/FlatPanes'

export interface TeamMailboxPaneProps {
  children: ReactNode
  'data-testid'?: string
}

/**
 * The one pane of the facade of a team mailbox, the same while it loads and
 * once it shows a folder: what lands in it does not move
 */
export function TeamMailboxPane({
  children,
  'data-testid': testId
}: TeamMailboxPaneProps): ReactElement {
  return (
    // One pane and no top bar: without these, twake-mui keeps room for its
    // top bar above the content below 1 024 px
    <Layout className="u-flex-auto u-ov-hidden" withTopBar={false} monoColumn>
      <FlatMain>
        <FlatContent data-testid={testId}>{children}</FlatContent>
      </FlatMain>
    </Layout>
  )
}
