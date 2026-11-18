// Upstream to twake-ui: yes. A modal that follows files being sent somewhere
// else (to a drive, by link): a title, a sentence, one chip per file with
// its progress and its cancel, and a Cancel for all. A centred dialog on
// desktop and tablets, a sheet from the bottom edge on phones (Figma
// "Teammail 1.1", "automatic save in drive"). twake-mui's `StandardDialog`
// is always centred and its `BottomSheet` is not modal.
import {
  Box,
  Button,
  Drawer,
  StandardDialog,
  Typography
} from '@linagora/twake-mui'
import { useId, type ReactElement } from 'react'

import { LiveRegion } from '@/ds/LiveRegion/LiveRegion'
import {
  UploadChip,
  type UploadListItem,
  type UploadListLabels
} from '@/ds/UploadList/UploadList'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

const SHEET_SX = {
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  maxHeight: '85dvh',
  pb: 'env(safe-area-inset-bottom)'
} as const

export interface TransferDialogProps {
  open: boolean
  /** "Attaching file" */
  title: string
  /** What happens to the files, e.g. "It will be uploaded to Drive" */
  description: string
  items: readonly UploadListItem[]
  labels: Pick<
    UploadListLabels,
    'remove' | 'retry' | 'progress' | 'failed' | 'done'
  >
  /** "Cancel": stops every file */
  cancelLabel: string
  /** The Cancel button or Escape; a click outside does nothing */
  onCancel: () => void
  /** Stops one file */
  onRemove: (id: string) => void
  /** Announced politely, e.g. the file being sent */
  status?: string
  /** Shown and announced at once, e.g. that some files failed */
  error?: string | null
  'data-testid'?: string
}

/**
 * A modal following files being sent: the focus goes in, Escape and Cancel
 * stop them all, the chip of a file stops it alone. A click outside does
 * not close it, so that a stray click does not lose an upload.
 */
export function TransferDialog({
  open,
  title,
  description,
  items,
  labels,
  cancelLabel,
  onCancel,
  onRemove,
  status = '',
  error = null,
  'data-testid': testId
}: TransferDialogProps): ReactElement {
  const titleId = useId()
  const descriptionId = useId()
  const isPhone = useScreenSize() === 'mobile'

  const content = (
    <>
      <Typography
        id={descriptionId}
        variant="body2"
        color="text.secondary"
        className="u-mb-1"
      >
        {description}
      </Typography>
      <Box component="ul" className="u-flex u-flex-column u-m-0 u-p-0">
        {items.map(item => (
          <UploadChip
            key={item.id}
            item={item}
            labels={labels}
            onRemove={onRemove}
          />
        ))}
      </Box>
      <LiveRegion>{status}</LiveRegion>
      {error === null ? null : (
        <Typography
          role="alert"
          variant="body2"
          color="error"
          className="u-mt-1"
        >
          {error}
        </Typography>
      )}
    </>
  )
  const cancel = (
    <Button variant="text" onClick={onCancel}>
      {cancelLabel}
    </Button>
  )

  if (isPhone) {
    return (
      <Drawer
        variant="temporary"
        anchor="bottom"
        open={open}
        onClose={(_event, reason) => {
          if (reason === 'escapeKeyDown') onCancel()
        }}
        disableEnforceFocus={false}
        sx={{ zIndex: theme => theme.zIndex.modal }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-modal': true,
            'aria-labelledby': titleId,
            'aria-describedby': descriptionId,
            // @ts-expect-error data attributes are valid on the paper
            'data-testid': testId,
            sx: SHEET_SX
          }
        }}
      >
        <Box className="u-p-1">
          <Typography
            id={titleId}
            variant="h6"
            component="h2"
            className="u-mb-half"
          >
            {title}
          </Typography>
          {content}
          <Box className="u-mt-1">{cancel}</Box>
        </Box>
      </Drawer>
    )
  }
  return (
    <StandardDialog
      open={open}
      size="small"
      // Without a reason: its close cross
      onClose={(_event, reason) => {
        if (reason !== 'backdropClick') onCancel()
      }}
      aria-describedby={descriptionId}
      data-testid={testId}
      title={title}
      content={content}
      actions={cancel}
    />
  )
}
