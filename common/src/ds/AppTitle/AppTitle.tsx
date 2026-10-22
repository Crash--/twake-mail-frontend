import { Mail, MailText } from '@linagora/twake-icons'
import { AppTitle as TwakeAppTitle, Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

export interface AppTitleProps {
  /** Accessible name of the logotype, e.g. "Twake Mail" */
  label: string
  'data-testid'?: string
}

/**
 * The Twake Mail logotype of twake-mui (app icon, "Twake", "Mail"): one image
 * whose accessible name is `label`
 */
export function AppTitle({
  label,
  'data-testid': testId
}: AppTitleProps): ReactElement {
  return (
    <Box
      role="img"
      aria-label={label}
      data-testid={testId}
      className="u-flex-shrink-0"
    >
      <TwakeAppTitle appIcon={Mail} appTextIcon={MailText} />
    </Box>
  )
}
