import { Icon, Label as LabelGlyph } from '@linagora/twake-icons'
import type { ReactElement } from 'react'

import { DEFAULT_LABEL_COLOR } from './queries'

export interface LabelIconProps {
  color: string | null | undefined
}

/** The label glyph in the colour of the label; decorative */
export function LabelIcon({ color }: LabelIconProps): ReactElement {
  return (
    <Icon icon={LabelGlyph} color={color ?? DEFAULT_LABEL_COLOR} aria-hidden />
  )
}
