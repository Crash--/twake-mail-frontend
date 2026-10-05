import { Pen } from '@linagora/twake-icons'
import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { ComposeButton } from '@/ds/ComposeButton/ComposeButton'
import { ResponsiveSidebar } from '@/ds/ResponsiveSidebar/ResponsiveSidebar'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import type { AppListEntry } from '@common/config/config'
import { LabelsSection } from '@common/features/labels/LabelsSection'
import { QuotaIndicator } from '@common/features/quota/QuotaIndicator'
import { useIsEmbedded } from '@common/features/embedding/embedding'
import { MailboxTree } from '@common/features/mailbox/MailboxTree'
import { useI18n } from '@common/i18n/useI18n'
import { AppTitle } from '@injected/layout/AppTitle'

import { AppGridMenu } from './AppGridMenu'

export interface MailSidebarProps {
  apps: readonly AppListEntry[]
  /** The drawer of the folders, below the desktop size */
  isDrawerOpen: boolean
  onDrawerClose: () => void
  onCompose: () => void
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
  onDrawerClose,
  onCompose
}: MailSidebarProps): ReactElement {
  const { t } = useI18n()
  const screenSize = useScreenSize()
  const isEmbedded = useIsEmbedded()

  return (
    <ResponsiveSidebar
      open={isDrawerOpen}
      onClose={onDrawerClose}
      label={t('layout.navigation')}
      closeLabel={t('common.close')}
      drawerHeader={
        <>
          <Box className="u-flex-auto u-ov-hidden">
            {isEmbedded ? null : <AppTitle />}
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
          <ComposeButton
            label={t('sidebar.newMessage')}
            icon={Pen}
            onClick={onCompose}
            data-testid="compose-email-button"
          />
        </Box>
      ) : null}
      <Box className="u-flex-auto u-ov-auto u-mt-1-half">
        <MailboxTree />
        <LabelsSection />
      </Box>
      <QuotaIndicator />
    </ResponsiveSidebar>
  )
}
