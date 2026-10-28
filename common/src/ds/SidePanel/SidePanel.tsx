import { Icon } from '@linagora/twake-icons'
import {
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import {
  useEffect,
  type ReactElement,
  type ReactNode,
  type RefObject
} from 'react'

import { Cross } from '@/ds/FlutterIcons/FlutterIcons'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

export const SIDE_PANEL_WIDTH = 365

const DESKTOP_SX = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  flex: 'none',
  width: SIDE_PANEL_WIDTH,
  minHeight: 0,
  m: '16px 16px 16px 0',
  borderRadius: '16px',
  overflow: 'hidden',
  bgcolor: 'background.paper'
} as const

const FULL_SCREEN_SX = {
  position: 'fixed',
  inset: 0,
  zIndex: 'modal',
  display: 'flex',
  flexDirection: 'column',
  bgcolor: 'background.paper'
} as const

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

export interface SidePanelProps {
  label: string
  src: string | null
  frameTitle: string
  isReady: boolean
  loadingLabel: string
  onClose: () => void
  closeLabel: string
  message?: ReactNode
  frameRef: RefObject<HTMLIFrameElement | null>
  allow?: string
  'data-testid'?: string
  frameTestId?: string
}

export function SidePanel({
  label,
  src,
  frameTitle,
  isReady,
  loadingLabel,
  onClose,
  closeLabel,
  message,
  frameRef,
  allow,
  'data-testid': testId,
  frameTestId
}: SidePanelProps): ReactElement {
  const isDesktop = useScreenSize() === 'desktop'
  const hasMessage = message !== undefined
  const isLoading = !isReady && !hasMessage

  useEffect(() => {
    if (isReady) frameRef.current?.focus()
  }, [isReady, frameRef])

  return (
    <Box
      component="aside"
      aria-label={label}
      sx={isDesktop ? DESKTOP_SX : FULL_SCREEN_SX}
      data-testid={testId}
    >
      <Box sx={FRAME_SX} aria-busy={isLoading}>
        {src !== null && !hasMessage ? (
          <iframe
            ref={frameRef}
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
            <CircularProgress aria-hidden="true" />
            <Typography>{loadingLabel}</Typography>
          </Box>
        ) : null}
        {isLoading || hasMessage ? (
          <Tooltip title={closeLabel}>
            <IconButton aria-label={closeLabel} onClick={onClose} sx={CLOSE_SX}>
              <Icon icon={Cross} aria-hidden="true" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
    </Box>
  )
}
