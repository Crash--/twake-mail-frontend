import { Avatar, nameToColor } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

// Kept for ds/RecipientField/RecipientAvatar, which still draws the
// gradients of tmail-flutter (`AppColor.mapGradientColor`)
const FIRST_GRADIENT = ['#21D4FD', '#B721FF'] as const
const GRADIENTS: readonly (readonly [string, string])[] = [
  FIRST_GRADIENT,
  ['#38F9D7', '#43E97B'],
  ['#11E6F0', '#4FACFE'],
  ['#E88395', '#EF9C8F'],
  ['#8DDAD5', '#00CDAC'],
  ['#E4ABF0', '#D96EED'],
  ['#F0FF00', '#58CFFB'],
  ['#EFC0D7', '#1AD5E4'],
  ['#FFD26F', '#3677FF'],
  ['#87A6F8', '#645FF6']
]

/** The gradient of a key (an address), as tmail-flutter picks it */
export function gradientOf(key: string): readonly [string, string] {
  let sum = 0
  for (let index = 0; index < key.length; index += 1) {
    sum += key.charCodeAt(index)
  }
  return GRADIENTS[sum % GRADIENTS.length] ?? FIRST_GRADIENT
}

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
