// Upstream to twake-ui: yes, in the theme overrides of `MuiIconButton`,
// `MuiButton`, `MuiChip` and `MuiMenuItem`. twake-mui sizes its controls
// for a mouse: a small `IconButton` is 32 px, a `Chip` 32 px high, below
// the 44 px a finger needs (WCAG 2.5.5, recommended by RGAA).
import { GlobalStyles } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

/** Smallest side of a touch target, in CSS pixels (WCAG 2.5.5) */
export const TOUCH_TARGET_SIZE = 44

/** On touch screens and on phones, whatever pointer they report */
export const TOUCH_MEDIA = `@media ${SCREEN_QUERIES.touch}, ${SCREEN_QUERIES.mobile}`

const STYLES = {
  [TOUCH_MEDIA]: {
    '.MuiIconButton-root': {
      minWidth: TOUCH_TARGET_SIZE,
      minHeight: TOUCH_TARGET_SIZE
    },
    '.MuiButton-root, .MuiChip-clickable, .MuiMenuItem-root, .MuiFab-root': {
      minHeight: TOUCH_TARGET_SIZE
    }
  }
} as const

/**
 * Grows the controls of twake-mui to touch targets of at least 44 × 44 px
 * on touch screens and phones. Render it once, in the app layout.
 */
export function TouchTargets(): ReactElement {
  return <GlobalStyles styles={STYLES} />
}
