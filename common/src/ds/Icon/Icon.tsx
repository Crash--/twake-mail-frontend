// Upstream to twake-ui: yes. `Icon` of `@linagora/twake-icons` draws an
// `svg` that assistive technologies may read as an empty graphic, or twice
// next to the text of its button. Unlabelled, an icon is decorative and
// should be hidden by default (RGAA 1.2.4, WCAG 1.1.1).
import {
  Icon as TwakeIcon,
  type IconProps as TwakeIconProps
} from '@linagora/twake-icons'
import type { ReactElement } from 'react'

export type IconProps = TwakeIconProps

const isLabelled = (props: IconProps): boolean =>
  props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined

/**
 * twake-icons' `Icon`, hidden from assistive technologies unless it is
 * named: a meaningful icon takes `role="img"` and an `aria-label`, and is
 * rendered as given. A caller may still pass `aria-hidden` itself.
 */
export function Icon(props: IconProps): ReactElement | null {
  return isLabelled(props) ? (
    <TwakeIcon {...props} />
  ) : (
    <TwakeIcon aria-hidden="true" focusable="false" {...props} />
  )
}
