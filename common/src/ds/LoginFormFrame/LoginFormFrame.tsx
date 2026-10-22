// Upstream to twake-ui: no. The sign-in card: the logotype, "Sign In" under
// it (`h2`), the message (`error.main` when it is an error), the fields 24 px
// apart and 40 px above the button, then the version in `caption`.
import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode, SubmitEvent } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

const LOGO_SX = {
  pt: '66px',
  display: 'flex',
  justifyContent: 'center',
  [`@media ${SCREEN_QUERIES.belowDesktop}`]: { pt: '67px' }
} as const

const TITLE_SX = {
  pt: '67px',
  typography: 'h2',
  color: 'text.primary',
  textAlign: 'center'
} as const

const MESSAGE_SX = {
  pt: '11px',
  pb: '36px',
  px: '58px',
  typography: 'body1',
  textAlign: 'center'
} as const

const FIELDS_SX = {
  width: '100%',
  boxSizing: 'border-box',
  px: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px'
} as const

const BUTTON_SX = {
  width: '100%',
  boxSizing: 'border-box',
  px: '24px',
  pt: '40px',
  pb: '16px'
} as const

const FOOTER_SX = { typography: 'body2', textAlign: 'center' } as const

// A build version can be one long word (a commit hash): it breaks anywhere
// rather than scroll a narrow screen sideways
const VERSION_SX = {
  maxWidth: '100%',
  boxSizing: 'border-box',
  pt: '8px',
  px: '24px',
  overflowWrap: 'anywhere',
  typography: 'caption',
  color: 'text.secondary',
  textAlign: 'center'
} as const

export interface LoginFormFrameProps {
  /** The logotype of the app */
  logo: ReactNode
  title: string
  titleId: string
  /** Under the title: what to do, or what went wrong */
  message: string
  isError?: boolean
  /** The fields */
  children: ReactNode
  /** The submit button */
  button: ReactNode
  /** Under the button, e.g. the link to the privacy policy */
  footer?: ReactNode
  /** e.g. "v.0.39.0", null to show none */
  version?: string | null
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void
  'data-testid'?: string
  'data-error-testid'?: string
}

/** The sign-in form, as tmail-flutter's card lays it out */
export function LoginFormFrame({
  logo,
  title,
  titleId,
  message,
  isError = false,
  children,
  button,
  footer = null,
  version = null,
  onSubmit,
  'data-testid': testId,
  'data-error-testid': errorTestId
}: LoginFormFrameProps): ReactElement {
  return (
    <Box
      component="form"
      noValidate
      aria-labelledby={titleId}
      onSubmit={onSubmit}
      className="u-flex u-flex-column u-flex-items-center u-w-100"
      data-testid={testId}
    >
      <Box sx={LOGO_SX}>{logo}</Box>
      <Typography component="h1" id={titleId} sx={TITLE_SX}>
        {title}
      </Typography>
      <Typography
        component="p"
        role={isError ? 'alert' : undefined}
        sx={{
          ...MESSAGE_SX,
          color: isError ? 'error.main' : 'text.primary'
        }}
        data-testid={isError ? errorTestId : undefined}
      >
        {message}
      </Typography>
      <Box sx={FIELDS_SX}>{children}</Box>
      <Box sx={BUTTON_SX}>{button}</Box>
      {footer === null ? null : (
        <Typography component="p" sx={FOOTER_SX}>
          {footer}
        </Typography>
      )}
      {version === null ? null : (
        <Typography component="p" sx={VERSION_SX}>
          {version}
        </Typography>
      )}
    </Box>
  )
}
