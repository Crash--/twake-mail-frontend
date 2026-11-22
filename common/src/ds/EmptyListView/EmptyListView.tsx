// Upstream to twake-ui: yes, `iconLook="tile"` of `Empty` in
// linagora/twake-ui#241. The `sx` below goes once it is published.
import { EmailOpen, Icon } from '@linagora/twake-icons'
import { Box, Empty, type SxProps, type Theme } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

// The empty-state tile of the Twake apps: 100 px in place of the 96 to 128 px
// `Empty` picks by screen width, the glyph in white on `action.selected`
const EMPTY_SX: SxProps<Theme> = {
  '& .Empty-icon': {
    width: 100,
    height: 100,
    mb: 3,
    display: 'grid',
    placeItems: 'center',
    borderRadius: '33%',
    bgcolor: 'action.selected',
    color: 'background.paper'
  }
}

export interface EmptyListViewProps {
  title: string
  /** Below the title, in grey; none when null */
  text?: string | null
  'data-testid'?: string
}

/**
 * An empty list of emails: a decorative open envelope, the reason as a title and
 * an optional hint below.
 */
export function EmptyListView({
  title,
  text = null,
  'data-testid': testId
}: EmptyListViewProps): ReactElement {
  return (
    <Empty
      icon={
        <Box aria-hidden>
          <Icon icon={EmailOpen} size={62} />
        </Box>
      }
      title={title}
      text={text}
      componentsProps={{ title: { component: 'p' } }}
      data-testid={testId}
      sx={EMPTY_SX}
    />
  )
}
