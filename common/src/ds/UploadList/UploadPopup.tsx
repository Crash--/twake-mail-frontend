// Upstream to twake-ui: with UploadList. The "uploading list popup" of the
// Twake Mail design, shown on desktop and tablet when more than 9 files
// upload at once: a floating panel that lists them, so that the form is not
// pushed away by dozens of chips.
import { Cross, Icon } from '@linagora/twake-icons'
import {
  Box,
  IconButton,
  Paper,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import {
  UploadChip,
  type UploadListItem,
  type UploadListLabels,
  type UploadTestIds
} from './UploadList'

export interface UploadPopupProps {
  items: readonly UploadListItem[]
  /** Name and title of the panel, e.g. "Uploading 12 files" */
  title: string
  closeLabel: string
  labels: Pick<
    UploadListLabels,
    'remove' | 'retry' | 'progress' | 'failed' | 'done'
  >
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onClose: () => void
  testIds?: UploadTestIds & { popup?: string; close?: string }
}

/**
 * A non modal panel at the bottom start of the screen listing the files
 * being uploaded, each with its progress and its cancel button. A
 * labelled region: the focus stays where it is, the title says what it holds.
 */
export function UploadPopup({
  items,
  title,
  closeLabel,
  labels,
  onRemove,
  onRetry,
  onClose,
  testIds = {}
}: UploadPopupProps): ReactElement {
  return (
    <Paper
      component="section"
      role="region"
      aria-label={title}
      elevation={8}
      sx={{
        position: 'fixed',
        insetInlineStart: 16,
        bottom: 16,
        zIndex: 'modal',
        width: 320,
        maxWidth: 'calc(100vw - 32px)',
        borderRadius: '8px',
        overflow: 'hidden'
      }}
      data-testid={testIds.popup}
    >
      <Box
        className="u-flex u-flex-items-center"
        sx={{ pl: 2, pr: 1, py: 0.5, bgcolor: 'background.default' }}
      >
        <Typography variant="subtitle2" component="h2" className="u-flex-auto">
          {title}
        </Typography>
        <Tooltip title={closeLabel}>
          <IconButton
            size="small"
            aria-label={closeLabel}
            onClick={onClose}
            data-testid={testIds.close}
          >
            <Icon icon={Cross} aria-hidden="true" />
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        component="ul"
        aria-label={title}
        className="u-flex u-flex-column"
        sx={{
          listStyle: 'none',
          m: 0,
          p: '12px',
          gap: '8px',
          maxHeight: 288,
          overflowY: 'auto'
        }}
      >
        {items.map(item => (
          <UploadChip
            key={item.id}
            item={item}
            labels={labels}
            onRemove={onRemove}
            onRetry={onRetry}
            testIds={testIds}
          />
        ))}
      </Box>
    </Paper>
  )
}
