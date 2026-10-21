import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { Navigate, Outlet } from 'react-router'

import { useJmapSession } from '@common/jmap/JmapSessionProvider'

/**
 * `/settings`: the list of the sections (below the desktop size, whose
 * sidebar lists them otherwise), or the section opened (`:section`). None
 * in a mailbox delegated to the user: its settings are the owner's, back
 * to its Inbox.
 */
export function SettingsPage(): ReactElement {
  const { view } = useJmapSession()
  if (view.kind === 'delegated') return <Navigate to="/" replace />
  return (
    <Box className="u-h-100 u-ov-auto" data-testid="settings-page">
      <Outlet />
    </Box>
  )
}
