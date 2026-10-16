import { Layout } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { FlatContent, FlatMain } from '@/ds/FlatPanes/FlatPanes'
import { SCRIPT_FOCUS_TARGET } from '@/ds/FocusIndicator/focusIndicator'
import { ReadingInsetContext } from '@/ds/ReadingPane/ReadingPane'

export interface TeamMailboxPaneProps {
  children: ReactNode
  /** Makes the pane the main content, focused after a navigation */
  id?: string
  'data-testid'?: string
}

/**
 * The one pane of the facade of a team mailbox, the same while it loads and
 * once it shows a folder: what lands in it does not move. It starts 16 px
 * below the tabs of TwakeSpace, and an open email scrolls 16 px inside its
 * sides (ADR 010 of twake-space-architecture).
 */
export function TeamMailboxPane({
  children,
  id,
  'data-testid': testId
}: TeamMailboxPaneProps): ReactElement {
  return (
    // One pane and no top bar: without these, twake-mui keeps room for its
    // top bar above the content below 1 024 px
    <Layout
      className="u-flex-auto u-ov-hidden u-pt-1"
      withTopBar={false}
      monoColumn
    >
      <FlatMain>
        <FlatContent
          data-testid={testId}
          {...(id === undefined
            ? {}
            : { id, tabIndex: -1, ...SCRIPT_FOCUS_TARGET })}
        >
          <ReadingInsetContext.Provider value>
            {children}
          </ReadingInsetContext.Provider>
        </FlatContent>
      </FlatMain>
    </Layout>
  )
}
