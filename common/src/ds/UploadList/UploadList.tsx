// Upstream to twake-ui: yes. A list of files being sent (attachments of a
// message, files of a chat or a Drive upload): name, size, progress,
// cancel or remove. twake-mui has neither the list nor the item.
import { Attachment, Cross, Icon, Warning } from '@linagora/twake-icons'
import {
  Box,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import type { ReactElement } from 'react'

export type UploadStatus = 'uploading' | 'done' | 'failed'

export interface UploadListItem {
  id: string
  name: string
  /** Formatted size, e.g. "12 KB" */
  size: string
  status: UploadStatus
  /** 0 to 100, while uploading */
  progress: number
}

export interface UploadListLabels {
  /** Name of the list, e.g. "Attachments (2)" */
  list: string
  /** Name of the button removing a file (or cancelling its upload) */
  remove: (name: string) => string
  /** Name of the progress bar of a file */
  progress: (name: string) => string
  /** Said of a file whose upload failed */
  failed: string
}

export interface UploadListProps {
  items: readonly UploadListItem[]
  labels: UploadListLabels
  onRemove: (id: string) => void
  /** Announced politely (e.g. "report.pdf uploaded") */
  status?: string
  testIds?: { list?: string; item?: string; remove?: string }
}

/**
 * The files of a message, as a named list: each says its name and size,
 * shows its progress while it uploads (a named `progressbar`), says when
 * it failed (an icon and the words, not a colour only), and has a button
 * removing it or cancelling its upload. Changes are announced through a
 * live region.
 */
export function UploadList({
  items,
  labels,
  onRemove,
  status,
  testIds = {}
}: UploadListProps): ReactElement {
  return (
    <Box>
      {items.length > 0 ? (
        <Box
          component="ul"
          aria-label={labels.list}
          className="u-flex u-flex-wrap"
          sx={{ listStyle: 'none', m: 0, p: 0, gap: 1 }}
          data-testid={testIds.list}
        >
          {items.map(item => (
            <Box
              component="li"
              key={item.id}
              className="u-flex u-flex-items-center"
              sx={{
                gap: 1,
                pl: 1.5,
                pr: 0.5,
                py: 0.5,
                maxWidth: '100%',
                width: 260,
                border: '1px solid',
                borderColor:
                  item.status === 'failed' ? 'error.main' : 'divider',
                borderRadius: 1
              }}
              data-testid={testIds.item}
              data-status={item.status}
            >
              <Icon
                icon={item.status === 'failed' ? Warning : Attachment}
                aria-hidden="true"
              />
              <Box className="u-flex-auto u-ov-hidden">
                <Typography variant="body2" noWrap title={item.name}>
                  {item.name}
                </Typography>
                <Typography variant="caption" color="textPrimary" noWrap>
                  {item.status === 'failed' ? labels.failed : item.size}
                </Typography>
                {item.status === 'uploading' ? (
                  <LinearProgress
                    variant="determinate"
                    value={item.progress}
                    aria-label={labels.progress(item.name)}
                  />
                ) : null}
              </Box>
              <Tooltip title={labels.remove(item.name)}>
                <IconButton
                  size="small"
                  aria-label={labels.remove(item.name)}
                  onClick={() => {
                    onRemove(item.id)
                  }}
                  data-testid={testIds.remove}
                >
                  <Icon icon={Cross} aria-hidden="true" />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      ) : null}
      {/* Always mounted: a live region only announces changes */}
      <Box role="status" className="u-visuallyhidden">
        {status}
      </Box>
    </Box>
  )
}
