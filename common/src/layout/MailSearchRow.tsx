import { Box } from '@linagora/twake-mui'
import { useRef, type ReactElement } from 'react'

import { useShortcuts } from '@common/features/shortcuts/ShortcutsProvider'

import { MailSearchBar } from './MailSearchBar'

/**
 * The search of a desktop: in the platform bar, as tmail-flutter, or at the
 * top of the page when the Workplace frames the app. The `/` shortcut
 * focuses it.
 */
export function MailSearchRow({
  'data-testid': testId
}: {
  'data-testid'?: string
}): ReactElement {
  const searchRef = useRef<HTMLDivElement>(null)
  useShortcuts({
    '/': () => searchRef.current?.querySelector('input')?.focus()
  })

  return (
    <Box ref={searchRef} data-testid={testId}>
      <MailSearchBar />
    </Box>
  )
}
