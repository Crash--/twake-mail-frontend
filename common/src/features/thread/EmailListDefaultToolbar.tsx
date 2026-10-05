import { Icon, Refresh, SelectAll } from '@linagora/twake-icons'
import { Box, Button, IconButton, Tooltip } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

import { EmailListFilterMenu } from './EmailListFilterMenu'
import type { EmailSelection } from './useEmailSelection'

export interface EmailListDefaultToolbarProps {
  selection: EmailSelection
  /** Emails loaded in the list: nothing to select without */
  loadedCount: number
  /** The folder shown, null for search results (no filter menu) */
  mailboxId: string | null
  onRefresh: () => void
}

/**
 * Above the list on desktops, while nothing is selected: refresh, select
 * all and filter. Selecting a row turns it into the selection toolbar.
 */
export function EmailListDefaultToolbar({
  selection,
  loadedCount,
  mailboxId,
  onRefresh
}: EmailListDefaultToolbarProps): ReactElement {
  const { t } = useI18n()
  const refreshLabel = t('common.refresh')

  return (
    <Box
      component="section"
      aria-label={t('thread.toolbar.label')}
      className="u-flex u-flex-items-center u-ph-1 u-pv-half"
      data-testid="list-toolbar"
    >
      <Tooltip title={refreshLabel}>
        <IconButton
          aria-label={refreshLabel}
          onClick={onRefresh}
          data-testid="list-refresh-button"
        >
          <Icon icon={Refresh} />
        </IconButton>
      </Tooltip>
      <Button
        variant="text"
        color="inherit"
        className="u-ml-1-half"
        startIcon={<Icon icon={SelectAll} />}
        disabled={loadedCount === 0}
        onClick={selection.selectLoaded}
        data-testid="list-select-all-button"
      >
        {t('thread.selection.selectAll')}
      </Button>
      {mailboxId === null ? null : (
        <EmailListFilterMenu mailboxId={mailboxId} className="u-ml-1-half" />
      )}
    </Box>
  )
}
