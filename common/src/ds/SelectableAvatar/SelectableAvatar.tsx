// Upstream to twake-ui: no, the compact rows of the list: the avatar of the
// sender is where a row is selected, and once selected it turns into a blue
// disc of the same size with a white check, in the middle of a 48 px touch
// target. The avatar is a checkbox of its own, reached by keyboard and named
// by its label.
import { Icon, Check } from '@linagora/twake-icons'
import { Box, ButtonBase } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement, ReactNode, Ref } from 'react'

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
  width: 20,
  height: 20,
  borderRadius: '50%',
  bgcolor: 'primary.main',
  color: 'primary.contrastText'
} as const

export interface SelectableAvatarProps {
  /** The avatar, 20 px */
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
  ref?: Ref<HTMLButtonElement>
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
  ref,
  'data-testid': testId
}: SelectableAvatarProps): ReactElement {
  const isSmall = size === 'small'
  return (
    <ButtonBase
      ref={ref}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      sx={isSmall ? SMALL_SX : BUTTON_SX}
      data-testid={testId}
    >
      {checked ? (
        <Box component="span" sx={isSmall ? SMALL_CHECKED_SX : CHECKED_SX}>
          <Icon icon={Check} size={isSmall ? 16 : 12} aria-hidden="true" />
        </Box>
      ) : (
        avatar
      )}
    </ButtonBase>
  )
}
