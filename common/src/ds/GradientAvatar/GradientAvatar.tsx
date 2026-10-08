// Upstream to twake-ui: no, the look of tmail-flutter. Its avatars are a
// gradient chosen from the address (the sum of its UTF-16 code units, modulo
// ten gradients), with the first letter of the name in white; twake-mui's
// `Avatar` takes one flat colour and two initials.
import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

/** The gradients of tmail-flutter (`AppColor.mapGradientColor`), top to bottom */
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

/** The first letter of a name, upper case, as tmail-flutter shows it */
export function firstLetterOf(name: string): string {
  const first = Array.from(name.trim())[0] ?? ''
  return first.toUpperCase()
}

export interface GradientAvatarProps {
  /** The letter(s) shown, e.g. `firstLetterOf(name)` */
  text: string
  /** Picks the gradient, e.g. the email address */
  colorKey: string
  /** Diameter in px */
  size?: number
  /** Size of the letter in px */
  fontSize?: number
  /** Decorative by default: the name is written next to it */
  'aria-hidden'?: boolean
  className?: string
  /**
   * `plain`: tmail-flutter's avatar of a suggested contact, a light grey
   * disc with a thin border and the initials in black
   */
  look?: 'gradient' | 'plain'
  'data-testid'?: string
}

const PLAIN_SX = {
  backgroundImage: 'none',
  backgroundColor: '#F8F8F8',
  border: '1px solid rgba(0, 0, 0, 0.08)',
  boxSizing: 'border-box',
  color: '#000000'
} as const

/** A round avatar on the gradient of `colorKey`, its letter in white */
export function GradientAvatar({
  text,
  colorKey,
  size = 32,
  fontSize = 12,
  'aria-hidden': ariaHidden = true,
  className,
  look = 'gradient',
  'data-testid': testId
}: GradientAvatarProps): ReactElement {
  const [from, to] = gradientOf(colorKey)
  return (
    <Box
      component="span"
      aria-hidden={ariaHidden}
      className={className}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundImage: `linear-gradient(to bottom, ${from}, ${to})`,
        color: '#FFFFFF',
        fontSize,
        fontWeight: 600,
        lineHeight: 1,
        userSelect: 'none',
        ...(look === 'plain' ? PLAIN_SX : {})
      }}
      data-testid={testId}
    >
      {text}
    </Box>
  )
}
