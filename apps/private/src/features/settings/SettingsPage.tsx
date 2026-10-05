import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { Outlet } from 'react-router'

/**
 * `/settings`: the list of the sections (below the desktop size, whose
 * sidebar lists them otherwise), or the section opened (`:section`).
 */
export function SettingsPage(): ReactElement {
  return (
    <Box className="u-h-100 u-ov-auto" data-testid="settings-page">
      <Outlet />
    </Box>
  )
}
