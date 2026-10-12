// Upstream to twake-icons: yes. "Reply all" and "Forward" of tmail-flutter
// (`ds/FlutterIcons`), at the size of the reply actions.
import { Icon } from '@linagora/twake-icons'
import type { ReactElement } from 'react'

import { Forward, ReplyAll } from '@/ds/FlutterIcons/FlutterIcons'

export interface ReplyIconProps {
  /** Side of the icon, in px */
  size?: number
}

/** tmail-flutter's "Reply all": two arrows */
export function ReplyAllIcon({ size = 20 }: ReplyIconProps): ReactElement {
  return <Icon icon={ReplyAll} size={size} aria-hidden="true" />
}

/** tmail-flutter's "Forward" */
export function ForwardIcon({ size = 20 }: ReplyIconProps): ReactElement {
  return <Icon icon={Forward} size={size} aria-hidden="true" />
}
