import { Box, Content, Layout, Main } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { Outlet } from 'react-router'

import type { AppListEntry } from '@common/config/config'

import { MailSidebar } from './MailSidebar'
import { TopBar } from './TopBar'

export interface AppLayoutProps {
  apps: readonly AppListEntry[]
}

/**
 * Frame of the signed-in pages: top bar, sidebar, and the routed content.
 */
export function AppLayout({ apps }: AppLayoutProps): ReactElement {
  return (
    <Box className="u-flex u-flex-column u-h-100">
      <TopBar apps={apps} />
      <Layout className="u-flex-auto u-ov-hidden" withTopBar>
        <MailSidebar />
        <Main>
          <Content data-testid="main-content">
            <Outlet />
          </Content>
        </Main>
      </Layout>
    </Box>
  )
}
