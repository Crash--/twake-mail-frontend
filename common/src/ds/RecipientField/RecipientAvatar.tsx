// Upstream to twake-ui: with RecipientField. twake-mui's `Avatar` writes its
// letter as text, which would end up in the name and the text of the chip:
// here the letter is drawn by CSS inside it.
import { Avatar, Box, nameToColor } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

export interface RecipientAvatarProps {
  /** The name or address the avatar stands for: its first letter shows */
  of: string
  /** Picks the colour, e.g. the address (`of` when absent) */
  colorKey?: string
}

/**
 * A decorative 24 px twake-mui `Avatar` in the colour of the address, the
 * first letter of the name drawn by CSS (`::before`), so it is neither read
 * nor part of the text of the chip.
 */
export function RecipientAvatar({
  of,
  colorKey = of
}: RecipientAvatarProps): ReactElement {
  const letter = Array.from(of.trim())[0]?.toUpperCase() ?? ''
  return (
    <Avatar
      size={24}
      color={nameToColor(colorKey)}
      aria-hidden="true"
      data-letter={letter}
      sx={{
        flexShrink: 0,
        // 8 px from the edge, as far as the delete cross is drawn from the
        // other one; 4 px from the name. Not through `MuiChip-avatar`, whose
        // grey 12 px letter would win.
        ml: '8px',
        mr: '-8px',
        '&::before': { content: 'attr(data-letter)' }
      }}
    >
      {/* Without a child, MUI draws its fallback person icon */}
      <Box component="span" />
    </Avatar>
  )
}
