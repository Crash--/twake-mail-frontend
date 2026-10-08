// Upstream to twake-ui: yes. twake-mui has dialogs, not windows docked at
// the bottom of the screen that can be minimized or put full screen while
// the page stays usable (Gmail's composer, chat windows): Mail needs them
// for the composer, Chat could for conversations.
import { Icon } from '@linagora/twake-icons'
import {
  Backdrop,
  Box,
  ButtonBase,
  GlobalStyles,
  Paper,
  SvgIcon,
  Typography
} from '@linagora/twake-mui'
import FocusTrap from '@mui/material/Unstable_TrapFocus'
import {
  useEffect,
  useId,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode
} from 'react'

import { Cross, Dash } from '@/ds/FlutterIcons/FlutterIcons'
import { ActionIconButton } from '@/ds/ActionIconButton/ActionIconButton'
import { useVisualViewport } from '@/ds/useVisualViewport/useVisualViewport'

/** Where the window is: in the dock, its title bar only, or over the page */
export type DockedWindowMode = 'normal' | 'minimized' | 'fullscreen'

/**
 * A window alone in the dock is 55 % of the screen wide and 85 % high, as
 * tmail-flutter's (`DesktopResponsiveContainerView`); several are 600 × 525
 * px each
 */
export const DOCKED_WINDOW_WIDTH = 790
export const SHARED_WINDOW_WIDTH = 600
const SHARED_WINDOW_HEIGHT = 525
/** Width of a minimized window (its title bar), in px */
export const MINIMIZED_WINDOW_WIDTH = 400

/** Height of a window on a tablet, measured on the design, in px */
const TABLET_WINDOW_HEIGHT = 710
const TITLE_BAR_HEIGHT = 52
/** The title of tmail-flutter's composer: Medium 17, black */
const TITLE_SX = {
  fontSize: 17,
  fontWeight: 500,
  lineHeight: '22px',
  color: '#000000'
} as const
/** Gap between the expanded window and the edges of the screen */
// tmail-flutter's full screen composer: 85 % × 90 % of the screen, centred
const FULLSCREEN_INSET = {
  top: '5vh',
  right: '7.5vw',
  bottom: '5vh',
  left: '7.5vw'
} as const
/** Material elevation 16, the shadow of tmail-flutter's composer */
const WINDOW_SHADOW =
  '0 8px 10px -5px rgba(0, 0, 0, 0.2), 0 16px 24px 2px rgba(0, 0, 0, 0.14), 0 6px 30px 5px rgba(0, 0, 0, 0.12)'

/** `view-transition-class` of the windows (and the backdrop) that opt in */
const VIEW_TRANSITION_CLASS = 'docked-window'

/**
 * A window is its own layer in a view transition of the page: the cross-fade
 * of the page would otherwise freeze it, then hide it under the opaque
 * snapshots of what navigates (flicker). Its layer stays above the page, shows
 * the new picture only, and neither fades nor moves.
 */
const VIEW_TRANSITION_STYLES = {
  [`::view-transition-group(*.${VIEW_TRANSITION_CLASS})`]: {
    zIndex: 2,
    animation: 'none'
  },
  [`::view-transition-old(*.${VIEW_TRANSITION_CLASS})`]: { display: 'none' },
  [`::view-transition-new(*.${VIEW_TRANSITION_CLASS})`]: { animation: 'none' }
} as const

// Material Icons paths (Apache-2.0): twake-icons has no "open in full" nor
// "close full screen" icon (docs/twake-mui-gaps.md)
const FULLSCREEN_PATH = 'M21 11V3h-8l3.29 3.29-10 10L3 13v8h8l-3.29-3.29 10-10z'
const EXIT_FULLSCREEN_PATH =
  'M22 3.41 16.71 8.7 20 12h-8V4l3.29 3.29L20.59 2zM2 20.59 7.29 15.3 4 12h8v8l-3.29-3.29L3.41 22z'

export interface DockedWindowLabels {
  minimize: string
  /** Back from the title bar to the window */
  restore: string
  fullscreen: string
  exitFullscreen: string
  close: string
}

export interface DockedWindowProps {
  /** Shown in the title bar, and the accessible name of the window */
  title: string
  mode: DockedWindowMode
  /**
   * Modal: over the page, behind a backdrop, the focus kept inside (full
   * screen, small screens). Not modal: the page stays usable around it.
   */
  isModal: boolean
  /** Small screens: no minimize nor full screen button, the window fills it */
  isCompact?: boolean
  /**
   * With `isCompact`: no title bar, the content has its own top bar (the
   * title stays the accessible name, visually hidden) and the window stays
   * above the virtual keyboard
   */
  isTitleBarHidden?: boolean
  /** Tablets: the title in the middle of the bar, the buttons at the end */
  isTitleCentered?: boolean
  /** Tablets: taller than the window of a desktop */
  isTall?: boolean
  /** Other windows share the dock: 525 px high rather than 85 % */
  isShared?: boolean
  /** Width in the dock, in px (the dock shrinks windows to fit) */
  width?: number
  labels: DockedWindowLabels
  onModeChange: (mode: DockedWindowMode) => void
  onClose: () => void
  /** Escape pressed in the window, not handled by what has the focus */
  onEscape: () => void
  /**
   * More controls of the title bar, before its buttons, e.g. the
   * `WindowOverflowMenu` when the window fills the screen
   */
  titleBarActions?: ReactNode
  /**
   * `view-transition-name` of the window, unique in the page: set, it stays
   * out of the view transitions of the page (see `VIEW_TRANSITION_STYLES`).
   * Its backdrop, when it has one, takes `<name>-backdrop`
   */
  viewTransitionName?: string
  children: ReactNode
  testIds?: {
    window?: string
    minimize?: string
    fullscreen?: string
    close?: string
  }
}

/**
 * Another MUI modal (menu, dialog) is over the page: let it hold the focus.
 * The page is the window's document, which is not the app's on the overlay
 * of TwakeSpace.
 */
function isTopmost(page: Document): boolean {
  return page.querySelector('.MuiModal-root:not(.MuiModal-hidden)') === null
}

/**
 * A window of the dock at the bottom end of the screen, as a `dialog`
 * named by its title:
 *
 * - `normal`: in the dock, not modal (the page around stays usable);
 * - `minimized`: its title bar only, which brings it back; its content
 *   stays mounted (nothing typed is lost) but hidden;
 * - `fullscreen`, or any mode when `isModal`: over the page behind a
 *   backdrop, the focus kept inside.
 *
 * The content is never remounted when the mode changes. Escape not handled
 * by a control reaches `onEscape`. Minimizing moves the focus to the title
 * bar; bringing the window back returns it where it was.
 */
export function DockedWindow({
  title,
  mode,
  isModal,
  isCompact = false,
  isTitleBarHidden = false,
  isTitleCentered = false,
  isTall = false,
  isShared = false,
  width = DOCKED_WINDOW_WIDTH,
  labels,
  onModeChange,
  onClose,
  onEscape,
  titleBarActions,
  viewTransitionName,
  children,
  testIds = {}
}: DockedWindowProps): ReactElement {
  const titleId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLButtonElement>(null)
  const lastFocused = useRef<HTMLElement | null>(null)
  const previousMode = useRef(mode)
  const isMinimized = mode === 'minimized' && !isModal
  const isFullscreen = mode === 'fullscreen' || isModal
  const hasNoTitleBar = isCompact && isTitleBarHidden
  const isCentered = isTitleCentered && !isMinimized
  // The visible part above the keyboard, where the layout does not follow it
  const visible = useVisualViewport(isFullscreen && isCompact)

  useEffect(() => {
    const before = previousMode.current
    previousMode.current = mode
    if (before === mode) return
    const root = rootRef.current
    if (!root) return
    // The document the window is rendered in, maybe not this window's
    const page = root.ownerDocument
    const active = page.activeElement
    // Brought back from its title bar, whose button went with the click
    const wasRestored = before === 'minimized' && active === page.body
    if (!root.contains(active) && !wasRestored) return
    if (mode === 'minimized') {
      restoreRef.current?.focus()
    } else if (before === 'minimized') {
      const target = lastFocused.current
      if (target?.isConnected && root.contains(target)) {
        target.focus()
      } else {
        root.focus()
      }
    }
  }, [mode])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    event.preventDefault()
    event.stopPropagation()
    onEscape()
  }

  const handleBodyFocus = (event: FocusEvent<HTMLDivElement>): void => {
    // Not `instanceof`: the window may be rendered in another document
    if (event.target.nodeType === Node.ELEMENT_NODE) {
      lastFocused.current = event.target
    }
  }

  const fullscreenLabel =
    mode === 'fullscreen' ? labels.exitFullscreen : labels.fullscreen

  const controls = (
    <>
      {isMinimized ? null : titleBarActions}
      {isCompact ? null : (
        <>
          <ActionIconButton
            label={isMinimized ? labels.restore : labels.minimize}
            onClick={() => {
              onModeChange(isMinimized ? 'normal' : 'minimized')
            }}
            data-testid={testIds.minimize}
          >
            <Icon icon={Dash} size={16} aria-hidden="true" />
          </ActionIconButton>
          <ActionIconButton
            label={fullscreenLabel}
            onClick={() => {
              onModeChange(mode === 'fullscreen' ? 'normal' : 'fullscreen')
            }}
            data-testid={testIds.fullscreen}
          >
            <SvgIcon aria-hidden="true">
              <path
                d={
                  mode === 'fullscreen' ? EXIT_FULLSCREEN_PATH : FULLSCREEN_PATH
                }
              />
            </SvgIcon>
          </ActionIconButton>
        </>
      )}
      <ActionIconButton
        label={labels.close}
        onClick={onClose}
        data-testid={testIds.close}
      >
        <Icon icon={Cross} size={16} aria-hidden="true" />
      </ActionIconButton>
    </>
  )

  return (
    <>
      {viewTransitionName === undefined ? null : (
        <GlobalStyles styles={VIEW_TRANSITION_STYLES} />
      )}
      <FocusTrap
        open={isFullscreen}
        isEnabled={() => isTopmost(rootRef.current?.ownerDocument ?? document)}
        disableAutoFocus
        disableRestoreFocus
      >
        <Paper
          ref={rootRef}
          role="dialog"
          aria-labelledby={titleId}
          aria-modal={isFullscreen ? true : undefined}
          tabIndex={-1}
          elevation={0}
          onKeyDown={handleKeyDown}
          className="u-flex u-flex-column u-ov-hidden"
          sx={[
            {
              pointerEvents: 'auto',
              // tmail-flutter's composer: a 28 px radius, elevation 16
              borderRadius: isMinimized ? '8px' : '28px',
              boxShadow: WINDOW_SHADOW,
              ...(viewTransitionName === undefined
                ? {}
                : {
                    viewTransitionName,
                    viewTransitionClass: VIEW_TRANSITION_CLASS
                  }),
              zIndex: theme =>
                isFullscreen ? theme.zIndex.modal : theme.zIndex.appBar + 1,
              '&:focus': { outline: 'none' }
            },
            isFullscreen && isCompact
              ? {
                  position: 'fixed',
                  inset: 0,
                  borderRadius: 0,
                  ...(visible === null
                    ? {}
                    : {
                        top: visible.top,
                        bottom: 'auto',
                        height: visible.height
                      })
                }
              : isFullscreen
                ? {
                    // Expanded as in the design: under the top bar of the
                    // app, the navigation still showing at the start
                    position: 'fixed',
                    top: FULLSCREEN_INSET.top,
                    right: FULLSCREEN_INSET.right,
                    bottom: FULLSCREEN_INSET.bottom,
                    left: FULLSCREEN_INSET.left
                  }
                : {
                    width: isMinimized ? MINIMIZED_WINDOW_WIDTH : width,
                    height: isMinimized
                      ? TITLE_BAR_HEIGHT
                      : isTall
                        ? `min(${TABLET_WINDOW_HEIGHT}px, calc(100dvh - 96px))`
                        : isShared
                          ? `min(${SHARED_WINDOW_HEIGHT}px, calc(100dvh - 40px))`
                          : '85dvh'
                  }
          ]}
          data-testid={testIds.window}
          data-mode={isModal ? 'fullscreen' : mode}
        >
          {hasNoTitleBar ? (
            <h2 id={titleId} className="u-visuallyhidden">
              {title}
            </h2>
          ) : (
            <Box
              className="u-flex u-flex-items-center u-flex-shrink-0"
              sx={{
                height: TITLE_BAR_HEIGHT,
                px: 2,
                bgcolor: 'background.default',
                borderBottom: isMinimized ? 'none' : '1px solid',
                borderColor: 'divider',
                gap: 0.5,
                ...(isCentered
                  ? { display: 'grid', gridTemplateColumns: '1fr auto 1fr' }
                  : {})
              }}
            >
              {isCentered ? <span /> : null}
              {isMinimized ? (
                <ButtonBase
                  ref={restoreRef}
                  onClick={() => {
                    onModeChange('normal')
                  }}
                  className="u-flex-auto u-ov-hidden u-h-100"
                  sx={{ justifyContent: 'flex-start', borderRadius: 1 }}
                  aria-label={`${labels.restore}: ${title}`}
                >
                  {/* Not a heading: it would sit inside the button, where it is lost */}
                  <Typography id={titleId} component="span" variant="h5" noWrap>
                    {title}
                  </Typography>
                </ButtonBase>
              ) : (
                <Typography
                  id={titleId}
                  component="h2"
                  variant="h5"
                  noWrap
                  className={isCentered ? undefined : 'u-flex-auto'}
                  sx={TITLE_SX}
                >
                  {title}
                </Typography>
              )}
              {isCentered ? (
                <Box
                  className="u-flex u-flex-items-center"
                  sx={{ gap: 0.5, justifyContent: 'flex-end' }}
                >
                  {controls}
                </Box>
              ) : (
                controls
              )}
            </Box>
          )}
          <Box
            className="u-flex u-flex-column u-flex-auto u-ov-hidden"
            onFocus={handleBodyFocus}
            // Minimized: kept mounted, so that nothing typed is lost
            hidden={isMinimized}
            sx={isMinimized ? { display: 'none' } : undefined}
          >
            {children}
          </Box>
        </Paper>
      </FocusTrap>
      {isFullscreen ? (
        <Backdrop
          open
          // The dock lets clicks through: not the backdrop
          sx={{
            // tmail-flutter dims the page behind (black at 38 %)
            ...(isCompact ? {} : { backgroundColor: 'rgba(0, 0, 0, 0.38)' }),
            zIndex: theme => theme.zIndex.modal - 1,
            pointerEvents: 'auto',
            ...(viewTransitionName === undefined
              ? {}
              : {
                  viewTransitionName: `${viewTransitionName}-backdrop`,
                  viewTransitionClass: VIEW_TRANSITION_CLASS
                })
          }}
          // A click on the backdrop does nothing: the window has its own
          // close button, and nothing typed must go by accident
          aria-hidden="true"
        />
      ) : null}
    </>
  )
}
