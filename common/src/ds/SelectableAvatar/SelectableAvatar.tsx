// Upstream to twake-ui: no, the look of tmail-flutter's compact rows: the
// avatar of the sender is where a row is selected, and once selected it
// turns into a blue disc with a white check. tmail-flutter selects with a
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
  width: 48,
  height: 48,
  borderRadius: '50%',
  bgcolor: 'primary.main',
  color: '#FFFFFF'
} as const

export interface SelectableAvatarProps {
  /** The avatar, 48 px */
  avatar: ReactNode
  checked: boolean
  onClick: (event: MouseEvent<HTMLElement>) => void
  /** Accessible name, e.g. "Select <subject>" */
  label: string
  'data-testid'?: string
}

/** The avatar of a compact row, a checkbox selecting the row */
export function SelectableAvatar({
  avatar,
  checked,
  onClick,
  label,
  'data-testid': testId
}: SelectableAvatarProps): ReactElement {
  return (
    <ButtonBase
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      sx={BUTTON_SX}
      data-testid={testId}
    >
      {checked ? (
        <Box component="span" sx={CHECKED_SX}>
          <Icon icon={Check} size={24} aria-hidden="true" />
        </Box>
      ) : (
        avatar
      )}
    </ButtonBase>
  )
}
