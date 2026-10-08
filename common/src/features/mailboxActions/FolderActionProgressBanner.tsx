import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { LiveRegion } from '@/ds/LiveRegion/LiveRegion'
import { ThinProgressBar } from '@/ds/ThinProgressBar/ThinProgressBar'
import { useI18n } from '@common/i18n/useI18n'

import { useFolderActionProgress } from './FolderActionProgress'

/**
 * Above the list while a long folder action runs, as tmail-flutter: a thin
 * bar, filled as the emails are done, sliding when the total is unknown.
 * Its start is said politely (the end is the toast of the action).
 */
export function FolderActionProgressBanner(): ReactElement {
  const { t } = useI18n()
  const { progress } = useFolderActionProgress()
  const label =
    progress === null
      ? ''
      : t(
          progress.kind === 'markAsRead'
            ? 'folders.progress.markAsRead'
            : 'folders.progress.empty',
          { folderName: progress.folderName }
        )

  return (
    <>
      <LiveRegion data-testid="folder-action-progress-status">
        {label}
      </LiveRegion>
      {progress === null ? null : (
        <Box
          className="u-mh-1 u-mt-1 u-mb-half"
          data-testid="folder-action-progress-banner"
        >
          <ThinProgressBar
            value={
              progress.total === null || progress.total === 0
                ? null
                : progress.done / progress.total
            }
            label={label}
            data-testid="folder-action-progress-bar"
          />
        </Box>
      )}
    </>
  )
}
