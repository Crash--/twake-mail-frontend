// Upstream to twake-ui: no, a composition of twake-mui's `Empty` with its
// tile look and the open envelope of twake-icons, for every empty email list.
import { EmailOpen } from '@linagora/twake-icons'
import { Empty } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

export interface EmptyListViewProps {
  title: string
  /** Below the title, in grey; none when null */
  text?: string | null
  'data-testid'?: string
}

/**
 * An empty list of emails: a decorative open envelope on twake-mui's empty
 * state tile, the reason as a title and an optional hint below.
 */
export function EmptyListView({
  title,
  text = null,
  'data-testid': testId
}: EmptyListViewProps): ReactElement {
  return (
    <Empty
      icon={EmailOpen}
      iconLook="tile"
      title={title}
      text={text}
      componentsProps={{ title: { component: 'p' } }}
      data-testid={testId}
    />
  )
}
