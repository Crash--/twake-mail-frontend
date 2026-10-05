// Upstream to twake-ui: yes. twake-mui has dialogs, not windows docked at
// the bottom of the screen that can be minimized or put full screen while
// the page stays usable (Gmail's composer, chat windows): Mail needs them
// for the composer, Chat could for conversations.
import { Cross, Dash, Icon } from '@linagora/twake-icons'
import {
  Backdrop,
  Box,
  ButtonBase,
  GlobalStyles,
  IconButton,
  Paper,
  SvgIcon,
  Tooltip,
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

/** Where the window is: in the dock, its title bar only, or over the page */
export type DockedWindowMode = 'normal' | 'minimized' | 'fullscreen'

/** Size of a window in the dock, in px */
export const DOCKED_WINDOW_WIDTH = 790
/** Width of a minimized window (its title bar), in px */
export const MINIMIZED_WINDOW_WIDTH = 400
const DOCKED_WINDOW_HEIGHT = 634
const TITLE_BAR_HEIGHT = 44
/** Material 3 elevation 3, the shadow of the composer in the design */
const WINDOW_SHADOW =
  '0 1px 3px rgba(0, 0, 0, 0.3), 0 4px 8px 3px rgba(0, 0, 0, 0.15)'

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

/** Another MUI modal (menu, dialog) is over the page: let it hold the focus */
function isTopmost(): boolean {
  return document.querySelector('.MuiModal-root:not(.MuiModal-hidden)') === null
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

  useEffect(() => {
    const before = previousMode.current
    previousMode.current = mode
    if (before === mode) return
    const root = rootRef.current
    if (!root) return
    const active = document.activeElement
    // Brought back from its title bar, whose button went with the click
    const wasRestored = before === 'minimized' && active === document.body
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
    if (event.target instanceof HTMLElement) lastFocused.current = event.target
  }

  const fullscreenLabel =
    mode === 'fullscreen' ? labels.exitFullscreen : labels.fullscreen

  return (
    <>
      {viewTransitionName === undefined ? null : (
        <GlobalStyles styles={VIEW_TRANSITION_STYLES} />
      )}
      <FocusTrap
        open={isFullscreen}
        isEnabled={isTopmost}
        disableAutoFocus
        disableRestoreFocus
      >
        <Paper
          ref={rootRef}
          role="dialog"
          aria-labelledby={titleId}
          aria-modal={isFullscreen ? true : undefined}
          tabIndex={-1}
          elevation={isFullscreen ? 24 : 0}
          onKeyDown={handleKeyDown}
          className="u-flex u-flex-column u-ov-hidden"
          sx={[
            {
              pointerEvents: 'auto',
              borderRadius: '8px',
              ...(isFullscreen ? {} : { boxShadow: WINDOW_SHADOW }),
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
              ? { position: 'fixed', inset: 0, borderRadius: 0 }
              : isFullscreen
                ? {
                    position: 'fixed',
                    top: '5vh',
                    left: '7.5vw',
                    width: '85vw',
                    height: '90vh'
                  }
                : {
                    width: isMinimized ? MINIMIZED_WINDOW_WIDTH : width,
                    height: isMinimized
                      ? TITLE_BAR_HEIGHT
                      : `min(${DOCKED_WINDOW_HEIGHT}px, calc(100vh - 96px))`
                  }
          ]}
          data-testid={testIds.window}
          data-mode={isModal ? 'fullscreen' : mode}
        >
          <Box
            className="u-flex u-flex-items-center u-flex-shrink-0"
            sx={{
              height: TITLE_BAR_HEIGHT,
              px: 2,
              bgcolor: 'background.default',
              borderBottom: isMinimized ? 'none' : '1px solid',
              borderColor: 'divider',
              gap: 0.5
            }}
          >
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
                <Typography id={titleId} variant="h5" noWrap>
                  {title}
                </Typography>
              </ButtonBase>
            ) : (
              <Typography
                id={titleId}
                component="h2"
                variant="h5"
                noWrap
                className="u-flex-auto"
              >
                {title}
              </Typography>
            )}
            {isMinimized ? null : titleBarActions}
            {isCompact ? null : (
              <>
                <Tooltip title={isMinimized ? labels.restore : labels.minimize}>
                  <IconButton
                    size="medium"
                    aria-label={isMinimized ? labels.restore : labels.minimize}
                    onClick={() => {
                      onModeChange(isMinimized ? 'normal' : 'minimized')
                    }}
                    data-testid={testIds.minimize}
                  >
                    <Icon icon={Dash} size={24} aria-hidden="true" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={fullscreenLabel}>
                  <IconButton
                    size="medium"
                    aria-label={fullscreenLabel}
                    onClick={() => {
                      onModeChange(
                        mode === 'fullscreen' ? 'normal' : 'fullscreen'
                      )
                    }}
                    data-testid={testIds.fullscreen}
                  >
                    <SvgIcon aria-hidden="true">
                      <path
                        d={
                          mode === 'fullscreen'
                            ? EXIT_FULLSCREEN_PATH
                            : FULLSCREEN_PATH
                        }
                      />
                    </SvgIcon>
                  </IconButton>
                </Tooltip>
              </>
            )}
            <Tooltip title={labels.close}>
              <IconButton
                size="medium"
                aria-label={labels.close}
                onClick={onClose}
                data-testid={testIds.close}
              >
                <Icon icon={Cross} size={24} aria-hidden="true" />
              </IconButton>
            </Tooltip>
          </Box>
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
