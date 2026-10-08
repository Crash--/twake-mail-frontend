// Upstream to twake-ui: no, the look of tmail-flutter's compact rows: the
// avatar of the sender is where a row is selected, and once selected it
// turns into a small blue disc with a white check (`ic_selected`, 24 px in
// the middle of the 48 px). tmail-flutter selects with a
// long press, then a tap on the avatar; here the avatar is a checkbox of
// its own, reached by keyboard and named by its label.
import { Icon } from '@linagora/twake-icons'
import { Box, ButtonBase } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement, ReactNode } from 'react'

import { Check } from '@/ds/FlutterIcons/FlutterIcons'

const BUTTON_SX = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  flexShrink: 0
} as const

const CHECKED_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  borderRadius: '50%',
  bgcolor: '#007AFF',
  color: '#FFFFFF'
} as const

export interface SelectableAvatarProps {
  /** The avatar, 48 px */
  avatar: ReactNode
  checked: boolean
  onClick: (event: MouseEvent<HTMLElement>) => void
  /** Accessible name, e.g. "Select <subject>" */
  label: string
  /**
   * `small`: 32 px, a full blue disc once checked, as the recipients of
   * tmail-flutter's forwarding (`ic_selected_recipient`)
   */
  size?: 'medium' | 'small'
  'data-testid'?: string
}

const SMALL_SX = { ...BUTTON_SX, width: 32, height: 32 } as const

const SMALL_CHECKED_SX = { ...CHECKED_SX, width: 32, height: 32 } as const

/** The avatar of a compact row, a checkbox selecting the row */
export function SelectableAvatar({
  avatar,
  checked,
  onClick,
  label,
  size = 'medium',
  'data-testid': testId
}: SelectableAvatarProps): ReactElement {
  const isSmall = size === 'small'
  return (
    <ButtonBase
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      sx={isSmall ? SMALL_SX : BUTTON_SX}
      data-testid={testId}
    >
      {checked ? (
        <Box component="span" sx={isSmall ? SMALL_CHECKED_SX : CHECKED_SX}>
          <Icon icon={Check} size={16} aria-hidden="true" />
        </Box>
      ) : (
        avatar
      )}
    </ButtonBase>
  )
}
