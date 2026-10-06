// Upstream to twake-ui: yes, as a full-screen file viewer shell (top bar with
// close, title and download over a dark backdrop, content slot), shared by
// Mail, Drive and Chat. Meanwhile local, on twake-mui `Dialog`.
import { Cross, Download, Icon } from '@linagora/twake-icons'
import {
  Box,
  Dialog,
  IconButton,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import {
  useId,
  type ReactElement,
  type ReactNode,
  type MouseEvent
} from 'react'

export interface FilePreviewDialogProps {
  open: boolean
  /** The file name, truncated in the bar (the whole name is its tooltip) */
  title: string
  closeLabel: string
  /** Absent: no download button (the file is not loaded yet) */
  downloadLabel?: string
  onClose: () => void
  /** The click's event tells which document the dialog is rendered in */
  onDownload?: (event: MouseEvent<HTMLElement>) => void
  children: ReactNode
  'data-testid'?: string
}

const PAPER_SX = {
  bgcolor: 'rgba(0, 0, 0, 0.85)',
  color: 'common.white',
  backgroundImage: 'none'
} as const

const BAR_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  px: 2,
  height: 52,
  flexShrink: 0,
  bgcolor: 'rgba(0, 0, 0, 0.3)'
} as const

const BODY_SX = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  display: 'flex',
  p: 2
} as const

/**
 * A full-screen modal showing one file. A named dialog (focus trapped then
 * given back to what opened it, Escape closes it, MUI), with its own close
 * and download buttons in a top bar.
 */
export function FilePreviewDialog({
  open,
  title,
  closeLabel,
  downloadLabel,
  onClose,
  onDownload,
  children,
  'data-testid': testId
}: FilePreviewDialogProps): ReactElement {
  const titleId = useId()
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      aria-labelledby={titleId}
      slotProps={{ paper: { sx: PAPER_SX } }}
      data-testid={testId}
    >
      <Box sx={BAR_SX}>
        <Tooltip title={closeLabel}>
          <IconButton
            color="inherit"
            aria-label={closeLabel}
            onClick={onClose}
            autoFocus
            data-testid={testId ? `${testId}-close` : undefined}
          >
            <Icon icon={Cross} aria-hidden="true" />
          </IconButton>
        </Tooltip>
        <Typography
          id={titleId}
          component="h2"
          variant="subtitle1"
          noWrap
          title={title}
          sx={{ flex: 1, minWidth: 0 }}
        >
          {title}
        </Typography>
        {downloadLabel !== undefined && onDownload ? (
          <Tooltip title={downloadLabel}>
            <IconButton
              color="inherit"
              aria-label={downloadLabel}
              onClick={onDownload}
              data-testid={testId ? `${testId}-download` : undefined}
            >
              <Icon icon={Download} aria-hidden="true" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
      {/* Focusable, so that the keyboard scrolls a long file */}
      <Box sx={BODY_SX} tabIndex={0} role="region" aria-label={title}>
        <Box sx={{ m: 'auto', maxWidth: '100%' }}>{children}</Box>
      </Box>
    </Dialog>
  )
}

export interface FilePreviewSurfaceProps {
  /**
   * `document`: a white page (an email, an HTML file) whatever the theme,
   * as the content is drawn for a white background; `text`: the theme's
   * paper, for plain text
   */
  kind: 'document' | 'text'
  children: ReactNode
  'data-testid'?: string
}

/** The surface a previewed file sits on, in the dark dialog */
export function FilePreviewSurface({
  kind,
  children,
  'data-testid': testId
}: FilePreviewSurfaceProps): ReactElement {
  return (
    <Box
      component={kind === 'text' ? 'pre' : 'div'}
      sx={
        kind === 'document'
          ? {
              bgcolor: '#fff',
              color: '#1b1b1f',
              width: 'min(900px, 100vw)',
              p: 2
            }
          : {
              bgcolor: 'background.paper',
              color: 'text.primary',
              maxWidth: 900,
              m: 0,
              p: 2,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere'
            }
      }
      data-testid={testId}
    >
      {children}
    </Box>
  )
}
