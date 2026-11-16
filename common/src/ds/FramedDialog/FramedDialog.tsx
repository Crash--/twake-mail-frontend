// Upstream to twake-ui: yes. A modal dialog holding another application in
// an iframe (the Twake Drive picker; Calendar and Chat embed it too): a
// named dialog, a loading state until the framed page says it is ready, the
// focus moved into the frame then, the size the framed page asks for, a
// close button the framed page can take over, full screen on phones.
// The frame is cozy-interapp's: it appends it to the frame box and styles
// that box as the framed page asks (`resize`). twake-mui's Dialog has no
// such variant.
import { Icon, Cross } from '@linagora/twake-icons'
import {
  Box,
  CircularProgress,
  Dialog,
  IconButton,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

/**
 * Size of the dialog when the framed page asks for none: 900 wide as Twake
 * Calendar and Twake Drive's own picker dialog (MUI `md`), 800 high as
 * Calendar
 */
const FRAMED_DIALOG_DEFAULT_SIZE = { width: 900, height: 800 } as const

/**
 * The dialog keeps a 16 px margin (MUI's 32 px default is reduced) and is
 * never larger than the screen minus that margin: nothing is cut
 */
const SCREEN_MARGIN = 'calc(100% - 32px)'

/**
 * The box of the frame, which sizes the dialog: 900 × 800 by default, the
 * size the framed page asks for once cozy-interapp sets it as inline styles
 * (`resize`: `width`, `height`, `maxWidth`, `maxHeight`, `transition`).
 * shortcut: the screen caps win over a `maxWidth` or `maxHeight` the page
 * asks for (`!important`), Drive asks for none; take the smaller if one does.
 */
const FRAME_SX = {
  position: 'relative',
  flex: '0 1 auto',
  minHeight: 0,
  width: FRAMED_DIALOG_DEFAULT_SIZE.width,
  height: FRAMED_DIALOG_DEFAULT_SIZE.height,
  maxWidth: '100% !important',
  maxHeight: '100% !important',
  '& iframe': { display: 'block', width: '100%', height: '100%', border: 0 },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none !important'
  }
} as const

/** Full screen on phones, whatever size the page asks for */
const PHONE_FRAME_SX = {
  ...FRAME_SX,
  flex: 1,
  width: 'auto !important',
  height: 'auto !important',
  maxWidth: 'none !important',
  maxHeight: 'none !important'
} as const

/**
 * The paper wraps the frame box, within the screen. Twice the class:
 * twake-mui caps the paper with `&.<size>` (544 px for its default
 * `medium`, which cut the 800 px asked here before)
 */
const PAPER_SX = {
  display: 'flex',
  flexDirection: 'column',
  '&&': {
    m: 2,
    width: 'auto',
    height: 'auto',
    maxWidth: SCREEN_MARGIN,
    maxHeight: SCREEN_MARGIN
  }
} as const

const PHONE_PAPER_SX = { display: 'flex', flexDirection: 'column' } as const

const OVERLAY_SX = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  p: 3,
  bgcolor: 'background.paper',
  textAlign: 'center'
} as const

const CLOSE_SX = { position: 'absolute', top: 8, right: 8, zIndex: 1 } as const

export interface FramedDialogProps {
  open: boolean
  /** Name of the dialog for screen readers; the framed page shows its own header */
  title: string
  /**
   * Gets the box the frame goes in (cozy-interapp's `start`), null once it
   * is gone
   */
  frameContainerRef: (element: HTMLElement | null) => void
  /** The framed page said it is ready: the loading state goes, the focus enters */
  isReady: boolean
  loadingLabel: string
  closeLabel: string
  onClose: () => void
  /**
   * The close button of the dialog. Hide it when the framed page shows its
   * own, so that there is only one; Escape still closes the dialog when the
   * focus is outside the frame. Always shown while loading and with a
   * `message`.
   */
  showCloseButton?: boolean
  /**
   * What the loading state shows instead of the progress indicator and its
   * text (Figma "Drive loading": the logo of the framed application in the
   * middle, its name at the bottom); the text stays for screen readers
   */
  loadingBrand?: { logo: ReactNode; name: ReactNode }
  /** Shown instead of the frame (an error and its actions) */
  message?: ReactNode
  /**
   * The owner moves the focus itself on close (e.g. into what the dialog
   * inserted) instead of back to what opened the dialog
   */
  disableRestoreFocus?: boolean
  'data-testid'?: string
  /** Test id of the box the frame goes in */
  frameTestId?: string
}

/**
 * A modal dialog framing another application, which fills it: a progress
 * indicator (`aria-busy`) until `isReady`, then the focus in the frame;
 * Escape (outside the frame) and the close button close it and give the
 * focus back to what opened it. Named by `title` (visually hidden: the
 * framed page has its own header). Full screen on phones; elsewhere
 * centred, at the size the framed page asks for (900 × 800 by default),
 * never larger than the screen.
 */
export function FramedDialog({
  open,
  title,
  frameContainerRef,
  isReady,
  loadingLabel,
  closeLabel,
  onClose,
  showCloseButton = true,
  message,
  loadingBrand,
  disableRestoreFocus = false,
  'data-testid': testId,
  frameTestId
}: FramedDialogProps): ReactElement {
  const titleId = useId()
  const isPhone = useScreenSize() === 'mobile'
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const containerRef = useCallback(
    (element: HTMLElement | null): void => {
      setContainer(element)
      frameContainerRef(element)
    },
    [frameContainerRef]
  )
  const hasMessage = message !== undefined
  const isLoading = !isReady && !hasMessage

  useEffect(() => {
    if (open && isReady) container?.querySelector('iframe')?.focus()
  }, [open, isReady, container])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="full"
      fullScreen={isPhone}
      maxWidth={false}
      aria-labelledby={titleId}
      disableRestoreFocus={disableRestoreFocus}
      slotProps={{
        paper: {
          sx: isPhone ? PHONE_PAPER_SX : PAPER_SX
        }
      }}
      data-testid={testId}
    >
      <h2 id={titleId} className="u-visuallyhidden">
        {title}
      </h2>
      <Box
        ref={containerRef}
        sx={isPhone ? PHONE_FRAME_SX : FRAME_SX}
        aria-busy={isLoading}
        data-testid={frameTestId}
      >
        {hasMessage ? (
          <Box sx={OVERLAY_SX} role="alert">
            {message}
          </Box>
        ) : isLoading ? (
          <Box sx={OVERLAY_SX} role="status">
            {loadingBrand === undefined ? (
              <>
                <CircularProgress aria-hidden="true" />
                <Typography>{loadingLabel}</Typography>
              </>
            ) : (
              <>
                <span className="u-visuallyhidden">{loadingLabel}</span>
                <Box aria-hidden="true">{loadingBrand.logo}</Box>
                <Box
                  aria-hidden="true"
                  sx={{ position: 'absolute', bottom: 24, left: 0, right: 0 }}
                >
                  {loadingBrand.name}
                </Box>
              </>
            )}
          </Box>
        ) : null}
        {showCloseButton || !isReady || hasMessage ? (
          <Tooltip title={closeLabel}>
            <IconButton aria-label={closeLabel} onClick={onClose} sx={CLOSE_SX}>
              <Icon icon={Cross} aria-hidden="true" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
    </Dialog>
  )
}
