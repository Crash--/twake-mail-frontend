import { Icon, type IconProps } from '@linagora/twake-icons'
import type { ReactElement, SVGProps } from 'react'

import { DEFAULT_LABEL_COLOR } from './queries'

export interface LabelIconProps {
  color: string | null | undefined
}

/**
 * The label glyph of `twake-icons` filled in: its own is an outline, and
 * the design draws the labels of the sidebar as solid tags
 */
function FilledLabelGlyph(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17 12" {...props}>
      <path d="M12.82.813a1.68 1.68 0 0 0-1.373-.708L2.184.114C1.258.114.5.864.5 1.79v8.42c0 .927.758 1.676 1.684 1.676l9.263.009a1.68 1.68 0 0 0 1.373-.707L16.5 6z" />
    </svg>
  )
}

const FILLED_LABEL: IconProps['icon'] = FilledLabelGlyph

/** The solid label glyph in the colour of the label; decorative */
export function LabelIcon({ color }: LabelIconProps): ReactElement {
  return (
    <Icon
      icon={FILLED_LABEL}
      color={color ?? DEFAULT_LABEL_COLOR}
      aria-hidden
    />
  )
}
