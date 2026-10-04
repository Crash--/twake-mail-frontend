import { Icon, Pen } from '@linagora/twake-icons'
import { Box, Button, ListSubheader, Nav, Sidebar } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

/**
 * Left column: the compose button and the mailbox tree.
 */
export function MailSidebar(): ReactElement {
  const { t } = useI18n()

  return (
    <Sidebar data-testid="sidebar">
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
      <Box className="u-flex-auto u-ov-auto u-mt-1">
        {/* TODO: mailbox tree, fed by Mailbox/get through jmap-client-ts */}
        <Nav
          role="tree"
          aria-label={t('sidebar.folders')}
          subheader={<ListSubheader>{t('sidebar.folders')}</ListSubheader>}
          data-testid="mailbox-tree"
        />
      </Box>
    </Sidebar>
  )
}
