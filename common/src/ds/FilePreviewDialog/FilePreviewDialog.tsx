// Upstream to twake-ui: yes, as a full-screen file viewer shell (top bar with
// close, title and download over a dark backdrop, content slot), shared by
// Mail, Drive and Chat. Meanwhile local, on twake-mui `Dialog`.
import { Icon, Download, Printer, Previous } from '@linagora/twake-icons'
import {
  alpha,
  Box,
  Dialog,
  IconButton,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import {
  useId,
  useRef,
  type ReactElement,
  type ReactNode,
  type MouseEvent,
  type Ref
} from 'react'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

export interface FilePreviewDialogProps {
  open: boolean
  /** The file name, truncated in the bar (the whole name is its tooltip) */
  title: string
  closeLabel: string
  /**
   * The close button, focused when the dialog opens: for the content to
   * give it the focus back when it removes the focused element
   */
  closeButtonRef?: Ref<HTMLButtonElement>
  /** Absent: no download button (the file is not loaded yet) */
  downloadLabel?: string
  onClose: () => void
  /** The click's event tells which document the dialog is rendered in */
  onDownload?: (event: MouseEvent<HTMLElement>) => void
  /** Absent: no print button (the file cannot be printed, or not yet) */
  printLabel?: string
  onPrint?: () => void
  children: ReactNode
  'data-testid'?: string
}

// The viewer dims the page behind a bar with the arrow back, the name and
// the actions, all white; the file on a page 80 % of the width (the whole
// width of a phone), 16 px under the bar
const BODY_SX = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  display: 'flex',
  py: 2
} as const

/**
 * A full-screen modal showing one file. A named dialog (focus trapped then
 * given back to what opened it, Escape closes it, MUI), with its own close,
 * download and print buttons in a top bar. A click on the dark background around
 * the file closes it too, as a click on a dialog's backdrop.
 */
export function FilePreviewDialog({
  open,
  title,
  closeLabel,
  closeButtonRef,
  downloadLabel,
  onClose,
  onDownload,
  printLabel,
  onPrint,
  children,
  'data-testid': testId
}: FilePreviewDialogProps): ReactElement {
  const titleId = useId()
  // As MUI's backdrop: the press must start on the background too, so that
  // a text selection dragged out of the file does not close the preview
  const isPressOnBackgroundRef = useRef(false)
  const handleBodyMouseDown = (event: MouseEvent<HTMLElement>): void => {
    isPressOnBackgroundRef.current = event.target === event.currentTarget
  }
  const handleBodyClick = (event: MouseEvent<HTMLElement>): void => {
    const isClickOnBackground = event.target === event.currentTarget
    if (isClickOnBackground && isPressOnBackgroundRef.current) onClose()
    isPressOnBackgroundRef.current = false
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      aria-labelledby={titleId}
      slotProps={{
        paper: {
          sx: theme => ({
            bgcolor: alpha(theme.palette.common.black, 0.54),
            color: 'common.white',
            backgroundImage: 'none'
          })
        }
      }}
      data-testid={testId}
    >
      <Box
        sx={theme => ({
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          color: 'common.white',
          height: 52,
          flexShrink: 0,
          bgcolor: alpha(theme.palette.common.black, 0.3)
        })}
      >
        <Tooltip title={closeLabel}>
          <IconButton
            ref={closeButtonRef}
            color="inherit"
            aria-label={closeLabel}
            onClick={onClose}
            autoFocus
            data-testid={testId ? `${testId}-close` : undefined}
          >
            <Icon icon={Previous} size={24} aria-hidden="true" />
          </IconButton>
        </Tooltip>
        <Typography
          id={titleId}
          component="h2"
          variant="subtitle1"
          noWrap
          title={title}
          sx={{ flex: 1, minWidth: 0, color: 'common.white' }}
        >
          {title}
        </Typography>
        {printLabel !== undefined && onPrint ? (
          <Tooltip title={printLabel}>
            <IconButton
              color="inherit"
              aria-label={printLabel}
              onClick={onPrint}
              data-testid={testId ? `${testId}-print` : undefined}
            >
              <Icon icon={Printer} size={24} aria-hidden="true" />
            </IconButton>
          </Tooltip>
        ) : null}
        {downloadLabel !== undefined && onDownload ? (
          <Tooltip title={downloadLabel}>
            <IconButton
              color="inherit"
              aria-label={downloadLabel}
              onClick={onDownload}
              data-testid={testId ? `${testId}-download` : undefined}
            >
              <Icon icon={Download} size={24} aria-hidden="true" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
      {/* Focusable, so that the keyboard scrolls a long file. A click on the
          background is a mouse shortcut of Escape and of the close button */}
      <Box
        sx={BODY_SX}
        tabIndex={0}
        role="region"
        aria-label={title}
        onMouseDown={handleBodyMouseDown}
        onClick={handleBodyClick}
      >
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
  const width = useScreenSize() === 'mobile' ? '100vw' : '80vw'
  return (
    <Box
      component={kind === 'text' ? 'pre' : 'div'}
      sx={
        kind === 'document'
          ? {
              bgcolor: 'common.white',
              color: 'grey.900',
              width,
              boxSizing: 'border-box',
              minHeight: 'calc(100dvh - 84px)',
              p: 2
            }
          : {
              bgcolor: 'background.paper',
              color: 'text.primary',
              width,
              boxSizing: 'border-box',
              minHeight: 'calc(100dvh - 84px)',
              m: 0,
              p: 1,
              typography: 'body2',
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
