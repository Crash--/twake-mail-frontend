// Upstream to twake-ui: yes. A modal dialog holding another application in
// an iframe (the Twake Drive picker; Calendar and Chat embed it too): a
// named dialog, a loading state until the framed page says it is ready, the
// focus moved into the frame then, the size the framed page asks for, a
// close button the framed page can take over, full screen on phones.
// twake-mui's Dialog has no such variant.
import { Icon } from '@linagora/twake-icons'
import {
  Box,
  CircularProgress,
  Dialog,
  IconButton,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import {
  useEffect,
  useId,
  useRef,
  type ReactElement,
  type ReactNode,
  type RefObject
} from 'react'

import { Cross } from '@/ds/FlutterIcons/FlutterIcons'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

/**
 * Size of the dialog when the framed page asks for none: 900 wide as Twake
 * Calendar and Twake Drive's own picker dialog (MUI `md`), 800 high as
 * Calendar
 */
export const FRAMED_DIALOG_DEFAULT_SIZE = { width: 900, height: 800 } as const

/**
 * The dialog keeps a 16 px margin (MUI's 32 px default is reduced) and is
 * never larger than the screen minus that margin: nothing is cut
 */
const SCREEN_MARGIN = 'calc(100% - 32px)'

/**
 * The size the framed page asks for, in CSS pixels (the `resize` message of
 * the cozy intents: `width` and `height` set the size, `maxWidth` and
 * `maxHeight` cap it), and the CSS transition to get there. The screen
 * still caps it all.
 */
export interface FrameSize {
  width?: number
  height?: number
  maxWidth?: number
  maxHeight?: number
  /** A CSS `transition` value, e.g. `height .2s ease-out` */
  transition?: string
}

const FRAME_SX = {
  position: 'relative',
  flex: 1,
  minHeight: 0,
  '& iframe': { display: 'block', width: '100%', height: '100%', border: 0 }
} as const

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

// What a CSS transition can hold: names, durations, timing functions. No
// `;`, `{` or `}`: the value goes into a style sheet.
const TRANSITION_PATTERN = /^[\w\s.,()%-]+$/

function cap(size: number | undefined, screen: string): string {
  return size === undefined ? screen : `min(${size}px, ${screen})`
}

function paperSx(size: FrameSize | null): Record<string, unknown> {
  const transition =
    size?.transition !== undefined && TRANSITION_PATTERN.test(size.transition)
      ? size.transition
      : undefined
  return {
    display: 'flex',
    flexDirection: 'column',
    // Twice the class: twake-mui caps the paper with `&.<size>` (544 px for
    // its default `medium`, which cut the 800 px asked here before)
    '&&': {
      m: 2,
      width: size?.width ?? FRAMED_DIALOG_DEFAULT_SIZE.width,
      height: size?.height ?? FRAMED_DIALOG_DEFAULT_SIZE.height,
      maxWidth: cap(size?.maxWidth, SCREEN_MARGIN),
      maxHeight: cap(size?.maxHeight, SCREEN_MARGIN),
      ...(transition === undefined ? {} : { transition })
    },
    '@media (prefers-reduced-motion: reduce)': {
      '&&': { transition: 'none' }
    }
  }
}

export interface FramedDialogProps {
  open: boolean
  /** Name of the dialog for screen readers; the framed page shows its own header */
  title: string
  /** The page to frame, null while it is not known yet */
  src: string | null
  /** Title of the iframe, for screen readers */
  frameTitle: string
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
  /** The size the framed page asks for, null for the default (900 × 800) */
  frameSize?: FrameSize | null
  /**
   * What the loading state shows instead of the progress indicator and its
   * text (Figma "Drive loading": the logo of the framed application in the
   * middle, its name at the bottom); the text stays for screen readers
   */
  loadingBrand?: { logo: ReactNode; name: ReactNode }
  /** Shown instead of the frame (an error and its actions) */
  message?: ReactNode
  frameRef?: RefObject<HTMLIFrameElement | null>
  /** Permissions of the framed page (`allow`) */
  allow?: string
  /**
   * The owner moves the focus itself on close (e.g. into what the dialog
   * inserted) instead of back to what opened the dialog
   */
  disableRestoreFocus?: boolean
  'data-testid'?: string
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
  src,
  frameTitle,
  isReady,
  loadingLabel,
  closeLabel,
  onClose,
  showCloseButton = true,
  frameSize = null,
  message,
  loadingBrand,
  frameRef,
  allow,
  disableRestoreFocus = false,
  'data-testid': testId,
  frameTestId
}: FramedDialogProps): ReactElement {
  const titleId = useId()
  const isPhone = useScreenSize() === 'mobile'
  const localRef = useRef<HTMLIFrameElement | null>(null)
  const ref = frameRef ?? localRef
  const hasMessage = message !== undefined
  const isLoading = !isReady && !hasMessage

  useEffect(() => {
    if (open && isReady) ref.current?.focus()
  }, [open, isReady, ref])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="full"
      fullScreen={isPhone}
      fullWidth
      maxWidth={false}
      aria-labelledby={titleId}
      disableRestoreFocus={disableRestoreFocus}
      slotProps={{
        paper: {
          sx: isPhone
            ? { display: 'flex', flexDirection: 'column' }
            : paperSx(frameSize)
        }
      }}
      data-testid={testId}
    >
      <h2 id={titleId} className="u-visuallyhidden">
        {title}
      </h2>
      <Box sx={FRAME_SX} aria-busy={isLoading}>
        {src !== null && !hasMessage ? (
          <iframe
            ref={ref}
            src={src}
            title={frameTitle}
            allow={allow}
            referrerPolicy="strict-origin-when-cross-origin"
            data-testid={frameTestId}
          />
        ) : null}
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
