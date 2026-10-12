import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { Pen } from '@/ds/FlutterIcons/FlutterIcons'
import { ComposeButton } from '@/ds/ComposeButton/ComposeButton'
import { ResponsiveSidebar } from '@/ds/ResponsiveSidebar/ResponsiveSidebar'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { LabelsSection } from '@common/features/labels/LabelsSection'
import { MailboxTree } from '@common/features/mailbox/MailboxTree'
import { SidebarSectionsProvider } from '@common/features/mailbox/SidebarSectionsProvider'
import { useI18n } from '@common/i18n/useI18n'

import { DrawerHeader } from './DrawerHeader'
import { MailSidebarFooter } from './MailSidebarFooter'

export interface MailSidebarProps {
  /** The drawer of the folders, below the desktop size */
  isDrawerOpen: boolean
  onDrawerClose: () => void
  onCompose: () => void
}

/**
 * The compose button and the mailbox tree: a column on a desktop, a drawer
 * on smaller screens. There, a floating button composes, and the drawer
 * header holds the logotype.
 */
export function MailSidebar({
  isDrawerOpen,
  onDrawerClose,
  onCompose
}: MailSidebarProps): ReactElement {
  const { t } = useI18n()
  const screenSize = useScreenSize()

  return (
    <SidebarSectionsProvider>
      <ResponsiveSidebar
        open={isDrawerOpen}
        onClose={onDrawerClose}
        label={t('layout.navigation')}
        closeLabel={t('common.close')}
        drawerHeader={<DrawerHeader />}
        data-testid="sidebar"
        drawerTestId="mailbox-drawer"
        closeButtonTestId="mailbox-drawer-close-button"
      >
        {screenSize === 'desktop' ? (
          <Box className="u-mh-1 u-mt-1">
            <ComposeButton
              label={t('sidebar.newMessage')}
              icon={Pen}
              onClick={onCompose}
              data-testid="compose-email-button"
            />
          </Box>
        ) : null}
        {/* As tmail-flutter: 24 px under the compose button (8 + 16), 16
            under the top of the drawer */}
        <Box
          className={`u-flex-auto u-ov-auto ${screenSize === 'desktop' ? 'u-mt-1-half' : 'u-mt-1'}`}
          data-testid="sidebar-scroll"
        >
          <MailboxTree />
          <LabelsSection />
        </Box>
        <MailSidebarFooter />
      </ResponsiveSidebar>
    </SidebarSectionsProvider>
  )
}
