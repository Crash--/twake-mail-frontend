// Upstream to twake-ui: yes. twake-mui's `AppTitle` draws its icons inline,
// so a deployment cannot change it; this one shows a logotype served as a
// file (twake-mui's AppTitle drawn as one SVG by default), 32 px high as
// twake-mui's, its width following the image.
import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

/** Height of twake-mui's AppTitle (its app icon) */
const HEIGHT = 32

export interface AppTitleProps {
  /** Accessible name of the logotype, e.g. "Twake Mail" */
  label: string
  /** URL of the logotype in the light scheme */
  src: string
  /** URL of the logotype in the dark scheme */
  darkSrc: string
  'data-testid'?: string
}

/**
 * The Twake Mail logotype: one visible image whose accessible name is
 * `label`. Both files are in the page and the scheme shows one
 * (`display: none` takes the other out of the accessibility tree), so that
 * the right one is painted from the first frame and follows a change of
 * scheme.
 */
export function AppTitle({
  label,
  src,
  darkSrc,
  'data-testid': testId
}: AppTitleProps): ReactElement {
  const image = { flexShrink: 0, height: HEIGHT, width: 'auto' } as const
  return (
    <Box
      component="span"
      data-testid={testId}
      sx={{ display: 'flex', flexShrink: 0 }}
    >
      <Box
        component="img"
        src={src}
        alt={label}
        sx={theme => ({
          ...image,
          display: 'block',
          ...theme.applyStyles('dark', { display: 'none' })
        })}
      />
      <Box
        component="img"
        src={darkSrc}
        alt={label}
        sx={theme => ({
          ...image,
          display: 'none',
          ...theme.applyStyles('dark', { display: 'block' })
        })}
      />
    </Box>
  )
}
