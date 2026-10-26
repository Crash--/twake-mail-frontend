// Upstream to twake-ui: no, a composition of twake-mui's `Empty` with its
// tile look and the open envelope of twake-icons, for every empty email list.
import { EmailOpen } from '@linagora/twake-icons'
import {
  Box,
  Button,
  Empty,
  type SxProps,
  type Theme
} from '@linagora/twake-mui'
import type { ReactElement, Ref } from 'react'

// Room between the hint and the action
const ACTION_SX: SxProps<Theme> = { mt: 2 }

/** A next step out of the empty list, as a button below the hint */
export interface EmptyListAction {
  label: string
  onClick: () => void
  'data-testid'?: string
}

export interface EmptyListViewProps {
  title: string
  /** Below the title, in grey; none when null */
  text?: string | null
  /** Below the hint; none when null */
  action?: EmptyListAction | null
  /** The title, which can take the focus (not with Tab) */
  titleRef?: Ref<HTMLParagraphElement>
  'data-testid'?: string
}

/**
 * An empty list of emails: a decorative open envelope on twake-mui's empty
 * state tile, the reason as a title, an optional hint below and an optional
 * action, an outlined button.
 */
export function EmptyListView({
  title,
  text = null,
  action = null,
  titleRef,
  'data-testid': testId
}: EmptyListViewProps): ReactElement {
  return (
    <Empty
      icon={EmailOpen}
      iconLook="tile"
      title={title}
      text={text}
      componentsProps={{
        title: {
          component: 'p',
          ref: titleRef,
          tabIndex: titleRef === undefined ? undefined : -1
        }
      }}
      data-testid={testId}
    >
      {action === null ? null : (
        <Box sx={ACTION_SX}>
          <Button
            variant="outlined"
            onClick={action.onClick}
            data-testid={action['data-testid']}
          >
            {action.label}
          </Button>
        </Box>
      )}
    </Empty>
  )
}
