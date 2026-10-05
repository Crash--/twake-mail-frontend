// Upstream to twake-ui: with RecipientField. twake-mui's `Avatar` writes its
// letter as text, which would end up in the name and the text of the chip.
import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

/** A hue from the text, the same for the same person everywhere */
function hueOf(text: string): number {
  let hash = 0
  for (const char of text) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360
  return hash
}

export interface RecipientAvatarProps {
  /** The name or address the avatar stands for: its first letter shows */
  of: string
}

/**
 * A decorative 20 px round avatar: the first letter of the name on a colour
 * taken from it. The letter is drawn by CSS (`::before`), so it is neither
 * read nor part of the text of the chip.
 */
export function RecipientAvatar({ of }: RecipientAvatarProps): ReactElement {
  const letter = Array.from(of.trim())[0]?.toUpperCase() ?? ''
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
        bgcolor: `hsl(${String(hueOf(of))} 60% 50%)`,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1,
        '&::before': { content: 'attr(data-letter)' }
      }}
    />
  )
}
