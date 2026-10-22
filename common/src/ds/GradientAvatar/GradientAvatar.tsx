import { Avatar, nameToColor } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

/** The first letter of a name, upper case */
export function firstLetterOf(name: string): string {
  const first = Array.from(name.trim())[0] ?? ''
  return first.toUpperCase()
}

export interface GradientAvatarProps {
  /** The letter(s) shown, e.g. `firstLetterOf(name)` */
  text: string
  /** Picks the colour, e.g. the email address */
  colorKey: string
  /** Diameter in px */
  size?: number
  /** Decorative by default: the name is written next to it */
  'aria-hidden'?: boolean
  className?: string
  'data-testid'?: string
}

/** A round twake-mui `Avatar` coloured from `colorKey`, showing `text` */
export function GradientAvatar({
  text,
  colorKey,
  size = 32,
  'aria-hidden': ariaHidden = true,
  className,
  'data-testid': testId
}: GradientAvatarProps): ReactElement {
  return (
    <Avatar
      aria-hidden={ariaHidden}
      className={className}
      size={size}
      color={nameToColor(colorKey)}
      data-testid={testId}
    >
      {text}
    </Avatar>
  )
}
