// Upstream to twake-ui: yes, to @linagora/twake-icons, which does not have the
// "More" of a row, three dots one above the other (ic_more_vertical.svg)
// (docs/twake-mui-gaps.md): drawn on the current text colour so that `Icon`
// can size and colour it.
import type { ReactElement, SVGAttributes } from 'react'
import { iconProps } from '@/ds/FlutterIcons/iconColor'

type SvgProps = SVGAttributes<SVGSVGElement>

/** Three dots one above the other, the "More" of a row */
export function MoreVerticalIcon(props: SvgProps): ReactElement {
  return (
    <svg viewBox="0 0 28 28" fill="currentColor" {...iconProps(props)}>
      <path d="M16.25 7C16.25 8.24264 15.2426 9.25 14 9.25C12.7574 9.25 11.75 8.24264 11.75 7C11.75 5.75736 12.7574 4.75 14 4.75C15.2426 4.75 16.25 5.75736 16.25 7ZM16.25 14C16.25 15.2426 15.2426 16.25 14 16.25C12.7574 16.25 11.75 15.2426 11.75 14C11.75 12.7574 12.7574 11.75 14 11.75C15.2426 11.75 16.25 12.7574 16.25 14ZM16.25 21C16.25 22.2426 15.2426 23.25 14 23.25C12.7574 23.25 11.75 22.2426 11.75 21C11.75 19.7574 12.7574 18.75 14 18.75C15.2426 18.75 16.25 19.7574 16.25 21Z" />
    </svg>
  )
}
