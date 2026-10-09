// Upstream to twake-icons: yes. The glyphs of tmail-flutter's sidebar
// (linagora_design_flutter's `LinagoraSidebar*`): the disclosure arrows are
// Material's `keyboard_arrow_down` / `keyboard_arrow_right`, the "new
// folder" and "new label" button is ic_add_new_folder.svg. Drawn in the
// current colour, for `Icon`.
import type { ReactElement, SVGAttributes } from 'react'

import { iconProps } from '@/ds/FlutterIcons/iconColor'

type SvgProps = SVGAttributes<SVGSVGElement>

/** Material's keyboard_arrow_down: an expanded section or folder */
export function DisclosureDown(props: SvgProps): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...iconProps(props)}>
      <path
        d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Material's keyboard_arrow_right: a collapsed section or folder */
export function DisclosureRight(props: SvgProps): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...iconProps(props)}>
      <path
        d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** tmail-flutter's ic_add_new_folder.svg */
export function AddNewFolder(props: SvgProps): ReactElement {
  return (
    <svg viewBox="0 0 20 20" fill="none" {...iconProps(props)}>
      <path
        d="M10 2.85693C10.3945 2.85693 10.7143 3.17673 10.7143 3.57122V9.28551L16.4286 9.28551C16.8231 9.28551 17.1429 9.6053 17.1429 9.99979C17.1429 10.3943 16.8231 10.7141 16.4286 10.7141L10.7143 10.7141L10.7143 16.4284C10.7143 16.8229 10.3945 17.1426 10 17.1426C9.60555 17.1426 9.28575 16.8229 9.28575 16.4284L9.28575 10.7141H3.57146C3.17697 10.7141 2.85718 10.3943 2.85718 9.99979C2.85718 9.6053 3.17697 9.28551 3.57146 9.28551H9.28575V3.57122C9.28575 3.17673 9.60555 2.85693 10 2.85693Z"
        fill="currentColor"
      />
    </svg>
  )
}
