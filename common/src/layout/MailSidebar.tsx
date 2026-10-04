import { Icon, Pen } from '@linagora/twake-icons'
import { Box, Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { ResponsiveSidebar } from '@/ds/ResponsiveSidebar/ResponsiveSidebar'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import type { AppListEntry } from '@common/config/config'
import { MailboxTree } from '@common/features/mailbox/MailboxTree'
import { useI18n } from '@common/i18n/useI18n'
import { AppTitle } from '@injected/layout/AppTitle'

import { AppGridMenu } from './AppGridMenu'

export interface MailSidebarProps {
  apps: readonly AppListEntry[]
  /** The drawer of the folders, below the desktop size */
  isDrawerOpen: boolean
  onDrawerClose: () => void
}

/**
 * The compose button and the mailbox tree: a column on a desktop, a drawer
 * on smaller screens. There, a floating button composes, and the drawer
 * header holds the logotype, and the app grid on phones (out of room in the
 * top bar).
 */
export function MailSidebar({
  apps,
  isDrawerOpen,
  onDrawerClose
}: MailSidebarProps): ReactElement {
  const { t } = useI18n()
  const screenSize = useScreenSize()

  return (
    <ResponsiveSidebar
      open={isDrawerOpen}
      onClose={onDrawerClose}
      label={t('layout.navigation')}
      closeLabel={t('common.close')}
      drawerHeader={
        <>
          <Box className="u-flex-auto u-ov-hidden">
            <AppTitle />
          </Box>
          {screenSize === 'mobile' ? <AppGridMenu apps={apps} /> : null}
        </>
      }
      data-testid="sidebar"
      drawerTestId="mailbox-drawer"
      closeButtonTestId="mailbox-drawer-close-button"
    >
      {screenSize === 'desktop' ? (
        <Box className="u-mh-1 u-mt-1">
          {/* TODO: open the composer once it exists */}
          <Button
            variant="contained"
            fullWidth
            startIcon={<Icon icon={Pen} />}
            data-testid="compose-email-button"
          >
            {t('sidebar.newMessage')}
          </Button>
        </Box>
      ) : null}
      <Box className="u-flex-auto u-ov-auto u-mt-1">
        <MailboxTree />
      </Box>
    </ResponsiveSidebar>
  )
}
