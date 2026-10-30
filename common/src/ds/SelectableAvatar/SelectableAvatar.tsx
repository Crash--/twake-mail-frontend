// Upstream to twake-ui: no, the compact rows of the list: the avatar of the
// sender is where a row is selected, and once selected it turns into
// the glyph of twake-mui's checked `Checkbox`, in the middle of a 48 px touch
// target. The avatar is a checkbox of its own, reached by keyboard and named by
// its label.
import { CheckSquare, Icon } from '@linagora/twake-icons'
import { ButtonBase } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement, ReactNode, Ref } from 'react'

const BUTTON_SX = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  flexShrink: 0
} as const

export interface SelectableAvatarProps {
  /** The avatar, 20 px */
  avatar: ReactNode
  checked: boolean
  onClick: (event: MouseEvent<HTMLElement>) => void
  /** Accessible name, e.g. "Select <subject>" */
  label: string
  /** `small`: 32 px, the recipients of the forwarding */
  size?: 'medium' | 'small'
  ref?: Ref<HTMLButtonElement>
  'data-testid'?: string
}

const SMALL_SX = { ...BUTTON_SX, width: 32, height: 32 } as const

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
        // The glyph of the checked Checkbox: a real one here would nest two
        // controls, this button already is the checkbox
        <Icon
          icon={CheckSquare}
          color="var(--twake-palette-primary-main)"
          aria-hidden="true"
        />
      ) : (
        avatar
      )}
    </ButtonBase>
  )
}
