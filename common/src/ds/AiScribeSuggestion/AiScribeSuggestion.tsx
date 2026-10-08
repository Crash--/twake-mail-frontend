// Upstream to twake-ui: no, the look of tmail-flutter's AI suggestion
// (`AiScribeSuggestionWidget`): a white card above the button that asked,
// 482 px wide at most (90 % of a narrow screen), 96 to 587 px high, a 16 px
// padding, a 6 px radius and a soft shadow; its title in Bold 14 and a close
// button; while waiting, a pulsing blue sparkle and "Generating response"
// with dots counting; then the answer in Regular 14 / 22, "Copy" and "Retry"
// icons, "Improve ⌄" on the left and "Replace", "Insert" pills on the right.
import { Icon, type IconProps } from '@linagora/twake-icons'
import {
  Box,
  ButtonBase,
  IconButton,
  Popover,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import { useId, type MouseEvent, type ReactElement } from 'react'

const SCREEN_MARGIN = 16
const ANCHOR_GAP = 8
const SHADOW =
  '0 0 0 0.5px rgba(66, 66, 68, 0.12), 0 6px 26px 2px rgba(66, 66, 68, 0.11)'
const SECONDARY_ICON = 'rgba(66, 66, 68, 0.72)'
const PRIMARY = '#0A84FF'

const TITLE_SX = {
  flex: 1,
  minWidth: 0,
  m: 0,
  fontSize: 14,
  lineHeight: '22px',
  letterSpacing: '0.4px',
  fontWeight: 700,
  color: 'rgba(26, 26, 26, 0.85)',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical'
} as const

const TEXT_SX = {
  fontSize: 14,
  lineHeight: '22px',
  letterSpacing: '0.4px',
  fontWeight: 400,
  color: 'rgba(26, 26, 26, 0.85)'
} as const

const PULSE_SX = {
  display: 'flex',
  color: '#00B7FF',
  animation: 'aiScribePulse 1.2s ease-in-out infinite alternate',
  '@keyframes aiScribePulse': {
    from: { transform: 'scale(0.95)', opacity: 0.7 },
    to: { transform: 'scale(1.05)', opacity: 1 }
  },
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' }
} as const

const DOTS_SX = {
  '&::after': {
    content: '""',
    animation: 'aiScribeDots 2s steps(4, end) infinite',
    '@keyframes aiScribeDots': {
      '0%': { content: '""' },
      '25%': { content: '"."' },
      '50%': { content: '".."' },
      '75%': { content: '"..."' }
    }
  },
  '@media (prefers-reduced-motion: reduce)': {
    '&::after': { animation: 'none', content: '"..."' }
  }
} as const

const ICON_BUTTON_SX = { p: '7px', color: SECONDARY_ICON } as const

const IMPROVE_SX = {
  gap: '4px',
  py: '6px',
  pl: '14px',
  pr: '10px',
  borderRadius: '4px',
  bgcolor: 'rgba(109, 120, 133, 0.08)',
  color: '#686E76',
  fontSize: 14,
  lineHeight: '18px',
  fontWeight: 500
} as const

function pillSx(isFilled: boolean): Record<string, unknown> {
  return {
    minWidth: 72,
    height: 36,
    px: '10px',
    borderRadius: '100px',
    fontSize: 14,
    lineHeight: '20px',
    letterSpacing: '0.1px',
    fontWeight: 500,
    color: isFilled ? '#FFFFFF' : PRIMARY,
    bgcolor: isFilled ? PRIMARY : 'transparent',
    '&:hover': {
      bgcolor: isFilled ? '#0067D6' : 'rgba(121, 116, 126, 0.08)'
    }
  }
}

export type AiScribeSuggestionState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'done'; text: string }

export interface AiScribeSuggestionLabels {
  close: string
  generating: string
  failed: string
  result: string
  copy: string
  retry: string
  improve: string
  replace: string
  insert: string
}

export interface AiScribeSuggestionIcons {
  sparkle: IconProps['icon']
  warning: IconProps['icon']
  close: IconProps['icon']
  copy: IconProps['icon']
  retry: IconProps['icon']
  chevron: IconProps['icon']
}

export interface AiScribeSuggestionProps {
  open: boolean
  /** The button that asked: the card opens above it */
  anchorEl: HTMLElement | null
  /** What was asked, e.g. "Change tone > More casual" */
  title: string
  state: AiScribeSuggestionState
  labels: AiScribeSuggestionLabels
  icons: AiScribeSuggestionIcons
  /** The close button, Escape, a click outside once the answer is there */
  onClose: () => void
  onCopy: (event: MouseEvent<HTMLElement>) => void
  onRetry: () => void
  /** "Improve": opens the menu of the assistant on the answer */
  onImprove: (anchor: HTMLElement) => void
  /** Null: "Replace" is not offered (nothing to replace) */
  onReplace: (() => void) | null
  onInsert: () => void
  /** On the card (the dialog) */
  'data-testid'?: string
}

/**
 * The answer of the AI assistant, a dialog named by what was asked. The
 * focus goes into it, Escape closes it, a click outside too once it is no
 * longer waiting, and the focus goes back to what opened it. The waiting
 * and the failure are announced.
 */
export function AiScribeSuggestion({
  open,
  anchorEl,
  title,
  state,
  labels,
  icons,
  onClose,
  onCopy,
  onRetry,
  onImprove,
  onReplace,
  onInsert,
  'data-testid': testId
}: AiScribeSuggestionProps): ReactElement {
  const titleId = useId()
  const handleClose = (
    _event: unknown,
    reason?: 'backdropClick' | 'escapeKeyDown'
  ): void => {
    // As tmail-flutter: a click outside does not stop the waiting
    if (reason === 'backdropClick' && state.status === 'loading') return
    onClose()
  }

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      disableScrollLock
      marginThreshold={SCREEN_MARGIN}
      transitionDuration={0}
      slotProps={{
        paper: {
          role: 'dialog',
          // @ts-expect-error data attributes are not in the paper props
          'data-testid': testId,
          'aria-labelledby': titleId,
          sx: {
            mt: `-${ANCHOR_GAP}px`,
            width: 'min(482px, 90vw)',
            minHeight: 96,
            maxHeight: 'min(587px, 90vh)',
            p: 2,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            borderRadius: '6px',
            boxShadow: SHADOW
          }
        }
      }}
    >
      <Box className="u-flex u-flex-items-center" sx={{ gap: 1 }}>
        <Typography id={titleId} component="h2" sx={TITLE_SX}>
          {title}
        </Typography>
        <Tooltip title={labels.close}>
          <IconButton
            aria-label={labels.close}
            onClick={onClose}
            sx={{ p: '3px', color: SECONDARY_ICON }}
            data-testid="ai-scribe-suggestion-close"
          >
            <Icon icon={icons.close} size={20} aria-hidden="true" />
          </IconButton>
        </Tooltip>
      </Box>
      <Box role="status" aria-live="polite">
        {state.status === 'loading' ? (
          <Box
            className="u-flex u-flex-items-center"
            sx={{ gap: 1, pl: 1, pb: 1 }}
            data-testid="ai-scribe-suggestion-loading"
          >
            <Box component="span" sx={PULSE_SX}>
              <Icon icon={icons.sparkle} size={22} aria-hidden="true" />
            </Box>
            <Box component="span" sx={{ ...TEXT_SX, ...DOTS_SX }}>
              {labels.generating}
            </Box>
          </Box>
        ) : null}
      </Box>
      {state.status === 'failed' ? (
        <Box
          role="alert"
          className="u-flex u-flex-items-center"
          sx={{ gap: 1, pl: 1, pb: 1 }}
          data-testid="ai-scribe-suggestion-error"
        >
          <Box component="span" sx={{ display: 'flex', color: '#FF3347' }}>
            <Icon icon={icons.warning} size={22} aria-hidden="true" />
          </Box>
          <Box component="span" sx={TEXT_SX}>
            {labels.failed}
          </Box>
        </Box>
      ) : null}
      {state.status === 'done' ? (
        <Box
          className="u-flex u-flex-column"
          sx={{ gap: 1, pb: 1, minHeight: 0 }}
        >
          <Box
            role="region"
            aria-label={labels.result}
            tabIndex={0}
            sx={{
              ...TEXT_SX,
              color: 'rgba(0, 0, 0, 0.85)',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              overflowY: 'auto',
              pr: 1,
              minHeight: 0
            }}
            data-testid="ai-scribe-suggestion-result"
          >
            {state.text}
          </Box>
          <Box className="u-flex" sx={{ gap: 0 }}>
            <Tooltip title={labels.copy}>
              <IconButton
                aria-label={labels.copy}
                onClick={onCopy}
                sx={ICON_BUTTON_SX}
                data-testid="ai-scribe-suggestion-copy"
              >
                <Icon icon={icons.copy} size={18} aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip title={labels.retry}>
              <IconButton
                aria-label={labels.retry}
                onClick={onRetry}
                sx={ICON_BUTTON_SX}
                data-testid="ai-scribe-suggestion-retry"
              >
                <Icon icon={icons.retry} size={18} aria-hidden="true" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box
            className="u-flex u-flex-items-center"
            sx={{ justifyContent: 'space-between', gap: 1, mt: '4px' }}
          >
            <ButtonBase
              aria-haspopup="menu"
              onClick={event => {
                onImprove(event.currentTarget)
              }}
              sx={IMPROVE_SX}
              data-testid="ai-scribe-suggestion-improve"
            >
              {labels.improve}
              <Icon icon={icons.chevron} size={16} aria-hidden="true" />
            </ButtonBase>
            <Box className="u-flex u-flex-items-center" sx={{ gap: 1 }}>
              {onReplace === null ? null : (
                <ButtonBase
                  onClick={onReplace}
                  sx={pillSx(false)}
                  data-testid="ai-scribe-suggestion-replace"
                >
                  {labels.replace}
                </ButtonBase>
              )}
              <ButtonBase
                onClick={onInsert}
                // The next step once the answer is there
                autoFocus
                sx={pillSx(true)}
                data-testid="ai-scribe-suggestion-insert"
              >
                {labels.insert}
              </ButtonBase>
            </Box>
          </Box>
        </Box>
      ) : null}
      {state.status === 'failed' ? (
        <Box className="u-flex" sx={{ justifyContent: 'flex-end' }}>
          <ButtonBase
            onClick={onRetry}
            sx={pillSx(false)}
            data-testid="ai-scribe-suggestion-retry"
          >
            {labels.retry}
          </ButtonBase>
        </Box>
      ) : null}
    </Popover>
  )
}
