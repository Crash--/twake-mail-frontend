// Upstream to twake-ui: no, the look of tmail-flutter's settings header
// (`SettingHeaderWidget`): the title in Semi Bold 24 black at 90 %, what the
// section is for in Regular 16/21 grey (#424244 at 64 %), 13 px under it.
import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode, Ref } from 'react'

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

const PANE_SX = {
  px: '30px',
  pt: '22px',
  pb: 3,
  '@media (max-width: 599.95px)': { px: 2, pt: 2 }
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
  children: ReactNode
}

/** What a settings section is for, under its title */
export function SettingsDescription({
  children
}: SettingsDescriptionProps): ReactElement {
  return (
    <Box component="p" sx={DESCRIPTION_SX}>
      {children}
    </Box>
  )
}
