// Upstream to twake-ui: no. The web sign-in page. On a desktop: the pitch of
// the product on the left (a title, its points with their 48 px icons, a
// drawing), a 458 x 684 card on the right (the shadow of the theme) and the
// "powered by" mark under it. Below the desktop size: the content of the
// card alone, on `background.paper`, the mark at the bottom.
import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { InsideMainLandmark } from '@/ds/MainLandmark/MainLandmark'
import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

export interface LoginPitchPoint {
  /** URL of a 48 px decorative icon */
  iconSrc: string
  text: string
}

export interface LoginLayoutProps {
  /** The title of the pitch; its line breaks are kept */
  pitchTitle: string
  pitchPoints: readonly LoginPitchPoint[]
  /** URL of the decorative drawing under the points */
  pitchImageSrc: string
  /** The sign-in form, centred in the card */
  children: ReactNode
  /** URL of the "powered by" mark, and its accessible name */
  footerImageSrc: string
  footerLabel: string
}

const PAGE_SX = {
  minHeight: '100%',
  boxSizing: 'border-box',
  bgcolor: 'background.paper',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  py: '60px',
  px: 2,
  [`@media ${SCREEN_QUERIES.belowDesktop}`]: {
    alignItems: 'center',
    p: 0
  }
} as const

const PITCH_SX = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  pr: '86px',
  [`@media ${SCREEN_QUERIES.belowDesktop}`]: { display: 'none' }
} as const

const PITCH_TITLE_SX = {
  typography: 'h1',
  color: 'text.primary',
  whiteSpace: 'pre-line'
} as const

const POINTS_SX = { listStyle: 'none', m: 0, mt: '8px', p: 0 } as const

const POINT_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  mt: 2,
  typography: 'h3',
  fontWeight: 400,
  color: 'text.primary'
} as const

const CARD_COLUMN_SX = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  [`@media ${SCREEN_QUERIES.belowDesktop}`]: {
    position: 'relative',
    width: '100%',
    maxWidth: 720,
    minHeight: 720
  }
} as const

const CARD_SX = {
  width: 458,
  height: 684,
  boxSizing: 'border-box',
  px: '31px',
  borderRadius: 2,
  bgcolor: 'background.paper',
  boxShadow: 3,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  [`@media ${SCREEN_QUERIES.belowDesktop}`]: {
    width: '100%',
    height: 'auto',
    px: 0,
    borderRadius: 0,
    boxShadow: 'none',
    overflow: 'visible'
  }
} as const

const FOOTER_SX = {
  pt: '44px',
  pb: '10px',
  [`@media ${SCREEN_QUERIES.belowDesktop}`]: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    p: 0
  }
} as const

/** The sign-in page: the pitch, the card holding the form, the mark */
export function LoginLayout({
  pitchTitle,
  pitchPoints,
  pitchImageSrc,
  children,
  footerImageSrc,
  footerLabel
}: LoginLayoutProps): ReactElement {
  return (
    <Box component="main" sx={PAGE_SX}>
      <Box sx={PITCH_SX} data-testid="login-pitch">
        <Typography component="p" sx={PITCH_TITLE_SX}>
          {pitchTitle}
        </Typography>
        <Box component="ul" sx={POINTS_SX}>
          {pitchPoints.map(point => (
            <Box component="li" key={point.text} sx={POINT_SX}>
              <img src={point.iconSrc} alt="" width={48} height={48} />
              {point.text}
            </Box>
          ))}
        </Box>
        <Box sx={{ pt: '44px' }}>
          <img src={pitchImageSrc} alt="" />
        </Box>
      </Box>
      <Box sx={CARD_COLUMN_SX}>
        <Box sx={CARD_SX}>
          <InsideMainLandmark>{children}</InsideMainLandmark>
        </Box>
        <Box sx={FOOTER_SX}>
          <img src={footerImageSrc} alt={footerLabel} width={97} height={44} />
        </Box>
      </Box>
    </Box>
  )
}
