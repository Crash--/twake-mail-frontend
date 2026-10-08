// Upstream to twake-ui: no, the look of tmail-flutter's settings header
// (`SettingHeaderWidget`): the title in Semi Bold 24 black at 90 %, what the
// section is for in Regular 16/21 grey (#424244 at 64 %), 13 px under it.
import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode, Ref } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

const TITLE_SX = {
  fontSize: 24,
  lineHeight: '28px',
  fontWeight: 600,
  letterSpacing: 0,
  color: 'rgba(0, 0, 0, 0.9)'
} as const

const DESCRIPTION_SX = {
  mt: '13px',
  mb: 0,
  fontSize: 16,
  lineHeight: '21px',
  fontWeight: 400,
  letterSpacing: '-0.15px',
  color: 'rgba(66, 66, 68, 0.64)'
} as const

/**
 * tmail-flutter's settings content on a desktop: its header 16 px inside a
 * 16 px padded card, the ink of the title 24 px from the side and 35 px
 * from the top of the card
 */
const PANE_SX = {
  px: '22px',
  pt: '31px',
  pb: 3,
  // Below, as tmail-flutter: what the section is for right under the bar,
  // 32 px in on a tablet, 16 px on a phone
  [`@media ${SCREEN_QUERIES.belowDesktop}`]: { px: '32px', pt: 0 },
  [`@media ${SCREEN_QUERIES.mobile}`]: { px: 2, pt: 0 }
} as const

export interface SettingsPaneProps {
  /** Names the region, e.g. by the id of its title */
  labelledBy: string
  children: ReactNode
  'data-testid'?: string
}

/** The content of a settings section, padded as tmail-flutter's */
export function SettingsPane({
  labelledBy,
  children,
  'data-testid': testId
}: SettingsPaneProps): ReactElement {
  return (
    <Box
      component="section"
      aria-labelledby={labelledBy}
      sx={PANE_SX}
      data-testid={testId}
    >
      {children}
    </Box>
  )
}

export interface SettingsTitleProps {
  id?: string
  /** Takes the focus when the section opens (`tabIndex={-1}`) */
  ref?: Ref<HTMLHeadingElement>
  className?: string
  children: ReactNode
}

/** The title of a settings section, the `h1` of the page */
export function SettingsTitle({
  id,
  ref,
  className,
  children
}: SettingsTitleProps): ReactElement {
  return (
    <Typography
      ref={ref}
      id={id}
      component="h1"
      tabIndex={-1}
      className={className}
      sx={TITLE_SX}
    >
      {children}
    </Typography>
  )
}

const SUBHEADING_SX = {
  mt: 3,
  mb: 2,
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 600,
  letterSpacing: '0.25px',
  color: '#424244'
} as const

export interface SettingsSubheadingProps {
  id?: string
  /** `h2` by default */
  component?: 'h2' | 'h3'
  children: ReactNode
}

/** A heading inside a settings section, as the titles of its options */
export function SettingsSubheading({
  id,
  component = 'h2',
  children
}: SettingsSubheadingProps): ReactElement {
  return (
    <Typography id={id} component={component} sx={SUBHEADING_SX}>
      {children}
    </Typography>
  )
}

export interface SettingsDescriptionProps {
  /**
   * Below the desktop size, as tmail-flutter's `SettingExplanationWidget`:
   * in the middle, right under the bar (which has the title), 16 px in
   */
  isCentered?: boolean
  children: ReactNode
}

const CENTERED_SX = {
  ...DESCRIPTION_SX,
  mt: 0,
  px: '16px',
  textAlign: 'center'
} as const

/** What a settings section is for, under its title */
export function SettingsDescription({
  isCentered = false,
  children
}: SettingsDescriptionProps): ReactElement {
  return (
    <Box component="p" sx={isCentered ? CENTERED_SX : DESCRIPTION_SX}>
      {children}
    </Box>
  )
}
