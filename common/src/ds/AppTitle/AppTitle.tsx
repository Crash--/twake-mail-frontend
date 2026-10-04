// Upstream to twake-ui: yes. twake-mui has an `Apptitle` in
// `dist/components/Apptitle` but does not export it; once exported, this
// copy goes away.
import { Icon, Mail, MailText, TwakeText } from '@linagora/twake-icons'
import { Stack } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

export interface AppTitleProps {
  /** Accessible name of the logotype, e.g. "Twake Mail" */
  label: string
  'data-testid'?: string
}

/**
 * The Twake Mail logotype, rebuilt from twake-icons: one image whose
 * accessible name is `label`, the icons inside being decorative.
 */
export function AppTitle({
  label,
  'data-testid': testId
}: AppTitleProps): ReactElement {
  return (
    <Stack
      direction="row"
      spacing={1}
      className="u-flex-items-center"
      role="img"
      aria-label={label}
      data-testid={testId}
    >
      <Icon icon={Mail} size={32} preserveColor aria-hidden="true" />
      <Icon icon={TwakeText} width={58} height={22} aria-hidden="true" />
      <Icon icon={MailText} width={54} height={22} aria-hidden="true" />
    </Stack>
  )
}
