import { AppBar, Box, Toolbar } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import type { AppListEntry } from '@common/config/config'
import { AppTitle } from '@injected/layout/AppTitle'

import { AppGridMenu } from './AppGridMenu'
import { MailSearchBar } from './MailSearchBar'
import { UserMenu } from './UserMenu'

export interface TopBarProps {
  apps: readonly AppListEntry[]
}

export function TopBar({ apps }: TopBarProps): ReactElement {
  return (
    <AppBar
      position="static"
      color="inherit"
      elevation={0}
      data-testid="top-bar"
    >
      <Toolbar className="u-flex u-flex-items-center">
        <AppTitle />
        <Box className="u-flex u-flex-auto u-flex-justify-center u-ph-2">
          <MailSearchBar />
        </Box>
        <AppGridMenu apps={apps} />
        <UserMenu />
      </Toolbar>
    </AppBar>
  )
}
