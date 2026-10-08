// Upstream to twake-ui: with RecipientField. twake-mui's `Avatar` writes its
// letter as text, which would end up in the name and the text of the chip.
import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { gradientOf } from '@/ds/GradientAvatar/GradientAvatar'

export interface RecipientAvatarProps {
  /** The name or address the avatar stands for: its first letter shows */
  of: string
  /** Picks the gradient, e.g. the address (`of` when absent) */
  colorKey?: string
}

/**
 * A decorative 20 px round avatar, as tmail-flutter's recipient tags: the
 * first letter of the name in white on the gradient of the address. The
 * letter is drawn by CSS (`::before`), so it is neither read nor part of
 * the text of the chip.
 */
export function RecipientAvatar({
  of,
  colorKey = of
}: RecipientAvatarProps): ReactElement {
  const letter = Array.from(of.trim())[0]?.toUpperCase() ?? ''
  const [from, to] = gradientOf(colorKey)
  return (
    <Box
      component="span"
      aria-hidden="true"
      data-letter={letter}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: 20,
        height: 20,
        borderRadius: '50%',
        color: 'common.white',
        backgroundImage: `linear-gradient(to bottom, ${from}, ${to})`,
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1,
        '&::before': { content: 'attr(data-letter)' }
      }}
    />
  )
}
